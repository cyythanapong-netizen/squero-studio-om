// The transport for squero/0: the only file in engine/modelica that knows sockets.

#include "squero/squero.hpp"

#include <cctype>
#include <chrono>
#include <cmath>
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <map>
#include <mutex>
#include <set>
#include <sstream>
#include <thread>

#include <cerrno>
#include <csignal>
#include <cstring>

#include <arpa/inet.h>
#include <fcntl.h>
#include <sys/socket.h>
#include <sys/wait.h>
#include <unistd.h>

#include <ixwebsocket/IXHttpServer.h>
#include <ixwebsocket/IXNetSystem.h>
#include <nlohmann/json.hpp>

#include "squero/generate.hpp"
#include "squero/import.hpp"

namespace squero {
namespace {

namespace fs = std::filesystem;
using nlohmann::json;

std::string status(OmcState state, const std::string& version) {
  return json{{"op", "status"}, {"state", name(state)}, {"version", version}}.dump();
}

ix::HttpResponsePtr respond(int code, const std::string& type, std::string body) {
  ix::WebSocketHttpHeaders headers;
  headers["Content-Type"] = type;
  headers["Cache-Control"] = "no-cache";
  return std::make_shared<ix::HttpResponse>(code, code == 200 ? "OK" : "Not Found", ix::HttpErrorCode::Ok, headers,
                                            std::move(body));
}

// The built app's files, only from inside `app`; `/` is index.html.
ix::HttpResponsePtr http(const fs::path& app, const ix::HttpRequestPtr& request) {
  if (app.empty()) return respond(404, "text/plain", "squero/0: connect over WebSocket\n");
  std::string path = request->uri.substr(0, request->uri.find('?'));
  if (path == "/") path = "/index.html";
  std::error_code ec;
  const fs::path root = fs::weakly_canonical(app, ec);
  const fs::path file = fs::weakly_canonical(app / path.substr(1), ec);
  const auto inside = file.lexically_relative(root);
  if (ec || inside.empty() || *inside.begin() == ".." || !fs::is_regular_file(file))
    return respond(404, "text/plain", "not found\n");
  static const std::map<std::string, std::string> types = {
      {".html", "text/html; charset=utf-8"}, {".js", "text/javascript; charset=utf-8"},
      {".css", "text/css; charset=utf-8"}, {".svg", "image/svg+xml"}, {".json", "application/json"},
      {".woff2", "font/woff2"}, {".png", "image/png"}};
  const auto type = types.find(file.extension().string());
  std::ifstream in(file, std::ios::binary);
  std::stringstream body;
  body << in.rdbuf();
  return respond(200, type == types.end() ? "application/octet-stream" : type->second, body.str());
}


// --- Studio's own ops ---

std::string trim(std::string s) {
  while (!s.empty() && std::isspace(static_cast<unsigned char>(s.back()))) s.pop_back();
  std::size_t a = 0;
  while (a < s.size() && std::isspace(static_cast<unsigned char>(s[a]))) ++a;
  return s.substr(a);
}

std::string text_of(const std::string& omc_answer) { return parse_value(omc_answer).atom; }

bool is_msl(const std::string& model) { return model == "Modelica" || model.starts_with("Modelica."); }

// A user model, never the library: Studio edits only the user's file.
std::string user_model(const json& in) {
  std::string model = in.value("model", "");
  if (model.empty() || is_msl(model) || model.find_first_of(" ;(){}\"") != std::string::npos)
    throw std::runtime_error("not a model Studio may edit: " + model);
  return model;
}

void ensure_library(Omc& omc, const std::string& cls) {
  const std::string top = cls.substr(0, cls.find('.'));
  for (const auto& v : parse_value(omc.call("getClassNames()")).items)
    if (v.atom == top) return;
  if (top == "Modelica") omc.call("loadModel(Modelica)");
}

// The class `file` defines, once loaded.
std::string load_file(Omc& omc, const fs::path& file) {
  ensure_library(omc, "Modelica");
  if (omc.call("loadFile(" + quote(fs::absolute(file).string()) + ")") != "true")
    throw std::runtime_error("cannot load " + file.string() + ": " + omc.errors());
  std::error_code ec;
  const fs::path want = fs::weakly_canonical(file, ec);
  for (const auto& v : parse_value(omc.call("getClassNames()")).items) {
    if (v.atom == "Modelica") continue;
    const std::string source = text_of(omc.call("getSourceFile(" + v.atom + ")"));
    if (!source.empty() && fs::weakly_canonical(source, ec) == want) return v.atom;
  }
  throw std::runtime_error("no class in " + file.string());
}

json op_open(Omc& omc, const json& in, const Session& session) {
  fs::path file;
  if (in.contains("file") && in["file"].is_string() && !in["file"].get<std::string>().empty()) {
    file = in["file"].get<std::string>();
  } else {
    file = session.file.empty() ? fs::path("Untitled.mo") : session.file;
  }
  if (in.contains("content") && in["content"].is_string()) {
    std::ofstream(file) << in["content"].get<std::string>();
  } else if (!fs::exists(file)) {
    const std::string name = file.stem().string();
    std::ofstream(file) << "model " << name << "\nend " << name << ";\n";
  }
  return {{"file", fs::absolute(file).string()}, {"model", load_file(omc, file)}};
}

json op_save(Omc& omc, const json& in) {
  const std::string model = user_model(in);
  std::string file = in.value("file", "");
  if (file.empty()) file = text_of(omc.call("getSourceFile(" + model + ")"));
  if (file.empty()) throw std::runtime_error(model + " has no file to save to");
  if (in.contains("content") && in["content"].is_string()) {
    std::ofstream(file) << in["content"].get<std::string>();
  } else {
    if (omc.call("save(" + model + ")") != "true") {
      const std::string listed = text_of(omc.call("list(" + model + ")"));
      if (!listed.empty()) {
        std::ofstream(file) << listed << "\n";
      } else {
        throw std::runtime_error("cannot save " + model + ": " + omc.errors());
      }
    }
  }
  return {{"file", file}};
}

json op_icon(Omc& omc, const json& in) {
  const std::string cls = in.value("class", "");
  if (cls.empty() || cls.find_first_of(" ;(){}\"") != std::string::npos) throw std::runtime_error("icon needs a class name");
  static std::mutex cache_mutex;
  static std::map<std::string, json> cache;  // library classes never change under Studio
  if (is_msl(cls)) {
    std::lock_guard lock(cache_mutex);
    if (const auto it = cache.find(cls); it != cache.end()) return it->second;
  }
  ensure_library(omc, cls);
  json out = import_class(omc, cls).to_json();
  if (is_msl(cls)) {
    std::lock_guard lock(cache_mutex);
    cache[cls] = out;
  }
  return out;
}

json op_set_icon(Omc& omc, const json& in) {
  const std::string model = user_model(in);
  if (!in.contains("icon") || !in["icon"].is_object()) throw std::runtime_error("set_icon needs an icon");
  const std::string icon = icon_annotation(in["icon"]);
  if (omc.call("addClassAnnotation(" + model + ", annotate=" + icon + ")") != "true")
    throw std::runtime_error("cannot set the icon: " + omc.errors());
  return json::object();
}

json op_generate(Omc& omc, const json& in, const Session& session) {
  GenerateOptions o{.source = in.value("source", ""), .model = in.value("model", ""), .out = in.value("out", ""),
                    .path = in.value("path", "auto"), .dry = in.value("dry", false), .live = true};
  if (o.source.empty()) throw std::runtime_error("generate needs a source .mo");
  if (!o.dry && o.out.empty()) throw std::runtime_error("generate needs an out folder");
  const json id = in.value("id", json());
  if (session.push)
    o.progress = [&](std::string_view stage, double fraction) {
      session.push(json{{"op", "progress"}, {"id", id}, {"stage", stage}, {"fraction", fraction}}.dump());
    };
  const GenerateResult r = generate(omc, o);
  json out{{"model", r.model}, {"path", r.path}, {"reason", r.reason}, {"out", r.out.string()}, {"notices", r.notices}};
  if (o.dry) out["files"] = r.files;
  return out;
}

// A free TCP port: bind to 0 and read back what the kernel chose.
int free_port() {
  const int fd = socket(AF_INET, SOCK_STREAM, 0);
  sockaddr_in a{};
  a.sin_family = AF_INET;
  a.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  socklen_t n = sizeof a;
  const bool ok = fd >= 0 && bind(fd, reinterpret_cast<sockaddr*>(&a), n) == 0 && getsockname(fd, reinterpret_cast<sockaddr*>(&a), &n) == 0;
  if (fd >= 0) close(fd);
  if (!ok) throw std::runtime_error("no free port");
  return ntohs(a.sin_port);
}

std::string base64(const std::string& in) {
  static const char* t = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  std::string out;
  for (std::size_t i = 0; i < in.size(); i += 3) {
    const unsigned v = (static_cast<unsigned char>(in[i]) << 16) | (i + 1 < in.size() ? static_cast<unsigned char>(in[i + 1]) << 8 : 0) |
                       (i + 2 < in.size() ? static_cast<unsigned char>(in[i + 2]) : 0);
    out += t[v >> 18 & 63];
    out += t[v >> 12 & 63];
    out += i + 1 < in.size() ? t[v >> 6 & 63] : '=';
    out += i + 2 < in.size() ? t[v & 63] : '=';
  }
  return out;
}

// The paperboat console: $PAPERBOAT_BIN or the one on PATH.
std::string paperboat_bin() {
  const char* e = std::getenv("PAPERBOAT_BIN");
  if (e && *e) return e;
  // the sibling checkout: <repo>/squero-studio-om/server/build/squero-om -> <repo>/paperboat/bin/paperboat
  std::error_code ec;
  const fs::path exe = fs::read_symlink("/proc/self/exe", ec);
  for (fs::path d = exe.parent_path(); !ec && d.has_parent_path() && d != d.root_path(); d = d.parent_path()) {
    const fs::path c = d.parent_path() / "paperboat" / "bin" / "paperboat";
    std::error_code missing;  // not `ec`: a missing candidate sets it, which would end the walk
    if (fs::is_regular_file(c, missing)) return c.string();
  }
  return "paperboat";
}

// Spawns paperboat in its own session, stdout and stderr to `log`; returns its pid.
pid_t spawn_paperboat(const std::vector<std::string>& args, const fs::path& log) {
  const std::string bin = paperboat_bin();
  std::vector<char*> argv{const_cast<char*>(bin.c_str())};
  for (const auto& a : args) argv.push_back(const_cast<char*>(a.c_str()));
  argv.push_back(nullptr);
  const int fd = open(log.c_str(), O_WRONLY | O_CREAT | O_TRUNC | O_CLOEXEC, 0644);
  if (fd < 0) throw std::runtime_error("cannot write " + log.string());
  const pid_t pid = fork();
  if (pid == 0) {
    setsid();
    const int null = open("/dev/null", O_RDONLY);
    dup2(null, 0);
    dup2(fd, 1);
    dup2(fd, 2);
    execvp(bin.c_str(), argv.data());
    dprintf(2, "cannot run %s: %s\n", bin.c_str(), std::strerror(errno));
    _exit(127);
  }
  close(fd);
  if (pid < 0) throw std::runtime_error("fork failed");
  return pid;
}

// Runs paperboat to the end; its exit code (127: it could not be started).
int run_paperboat(const std::vector<std::string>& args, const fs::path& log) {
  const pid_t pid = spawn_paperboat(args, log);
  int st = 0;
  waitpid(pid, &st, 0);
  return WIFEXITED(st) ? WEXITSTATUS(st) : -1;
}

// The last lines of a log, for an error the user can act on.
std::string log_tail(const fs::path& log, std::size_t lines = 12) {
  std::ifstream f(log);
  std::vector<std::string> all;
  for (std::string l; std::getline(f, l);) all.push_back(l);
  std::string out;
  for (std::size_t i = all.size() > lines ? all.size() - lines : 0; i < all.size(); ++i) out += all[i] + "\n";
  return out;
}

std::runtime_error paperboat_failed(const std::string& what, int code, const fs::path& log) {
  std::string msg = "paperboat " + what + " failed (exit " + std::to_string(code) + ")";
  if (code == 127) msg += "; is paperboat on PATH or PAPERBOAT_BIN set?";
  const std::string tail = log_tail(log);
  return std::runtime_error(msg + (tail.empty() ? "" : ":\n" + tail) + "full log: " + log.string());
}

bool listening(int port) {
  const int fd = socket(AF_INET, SOCK_STREAM, 0);
  sockaddr_in a{};
  a.sin_family = AF_INET;
  a.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  a.sin_port = htons(static_cast<uint16_t>(port));
  const bool ok = fd >= 0 && connect(fd, reinterpret_cast<sockaddr*>(&a), sizeof a) == 0;
  if (fd >= 0) close(fd);
  return ok;
}

// Backends started by "serve": port -> (`paperboat start` pid, its log).
std::mutex served_mutex;
std::map<int, std::pair<pid_t, fs::path>> served;

// "status": building (not listening yet), running, or exited (with the log's tail).
json serve_status(int port) {
  std::lock_guard lock(served_mutex);
  const auto it = served.find(port);
  if (it == served.end()) throw std::runtime_error("no backend started on port " + std::to_string(port));
  const auto [pid, log] = it->second;
  int st = 0;
  std::string state = listening(port) ? "running" : "building";
  if (waitpid(pid, &st, WNOHANG) == pid) {
    state = "exited";
    served.erase(it);
  }
  return json{{"port", port}, {"name", log.stem().string()}, {"state", state}, {"log", log_tail(log)}};
}

// "stop": `paperboat stop <port>` once it listens, then the rest of its session (a build in flight).
json serve_stop(int port) {
  const fs::path log = fs::temp_directory_path() / "ssom_stop.log";
  if (listening(port))
    if (const int code = run_paperboat({"stop", std::to_string(port)}, log); code != 0)
      throw paperboat_failed("stop " + std::to_string(port), code, log);
  std::lock_guard lock(served_mutex);
  if (const auto it = served.find(port); it != served.end()) {
    kill(-it->second.first, SIGTERM);
    waitpid(it->second.first, nullptr, 0);
    served.erase(it);
  }
  return json{{"port", port}, {"state", "stopped"}};
}

// Export without a folder of the user's, into <tmp>/ssom_<model>: mode "ppk" packs it and returns
// the archive (base64); "serve" starts it on a free port and returns at once (poll "status": the
// first start builds the engine, minutes); "stop" ends one.
json op_export(Omc& omc, const json& in, const Session& session) {
  const std::string mode = in.value("mode", "ppk");
  if (mode == "status") return serve_status(in.value("port", 0));
  if (mode == "stop") return serve_stop(in.value("port", 0));
  if (mode != "ppk" && mode != "serve") throw std::runtime_error("export mode is ppk, serve, status or stop");
  std::string stem = in.value("model", "model");
  stem = stem.substr(stem.rfind('.') == std::string::npos ? 0 : stem.rfind('.') + 1);
  for (auto& c : stem) if (!std::isalnum(static_cast<unsigned char>(c))) c = '_';
  const fs::path dir = fs::temp_directory_path() / ("ssom_" + stem);
  json g = in;
  g["out"] = dir.string();
  g["dry"] = false;
  json out = op_generate(omc, g, session);
  if (session.push) session.push(json{{"op", "progress"}, {"id", in.value("id", json())}, {"stage", "build"}, {"fraction", 0.8}}.dump());
  const fs::path log = dir.string() + ".log";
  if (mode == "ppk") {
    const fs::path ppk = dir.string() + ".ppk";
    // pack verifies first, and the catalog check builds a C++ backend: minutes on a cold build/
    if (const int code = run_paperboat({"pack", dir.string(), "--out", ppk.string()}, log); code != 0)
      throw paperboat_failed("pack", code, log);
    std::ifstream f(ppk, std::ios::binary);
    out["file"] = "ssom_" + stem + ".ppk";
    out["ppk"] = base64(std::string(std::istreambuf_iterator<char>(f), {}));
  } else {
    const int port = free_port();
    const pid_t pid = spawn_paperboat({"start", dir.string(), "--port", std::to_string(port)}, log);
    {
      std::lock_guard lock(served_mutex);
      served[port] = {pid, log};
    }
    out["name"] = "ssom_" + stem;
    out["state"] = "building";
    out["port"] = port;
    out["log"] = log.string();
  }
  return out;
}

// One CSV row of numbers; NaN and infinity become null (JSON has neither).
std::vector<json> numbers(const std::string& line) {
  std::vector<json> out;
  std::stringstream row(line);
  for (std::string cell; std::getline(row, cell, ',');) {
    const double v = std::strtod(cell.c_str(), nullptr);
    out.push_back(std::isfinite(v) ? json(v) : json());
  }
  return out;
}

// A test stimulus for a top-level input, as Modelica: {kind: constant|step|ramp|sine, k, t0, f}.
std::string stimulus(const json& s, bool boolean) {
  const auto num = [&](const char* key, double fallback) {
    const double v = s.contains(key) && s[key].is_number() ? s[key].get<double>() : fallback;
    if (!std::isfinite(v)) throw std::runtime_error(std::string("stimulus ") + key + " must be a number");
    std::ostringstream out;
    out.precision(17);
    out << v;
    return "(" + out.str() + ")";
  };
  const std::string kind = s.value("kind", "constant");
  const std::string k = num("k", 0), t0 = num("t0", 0);
  if (boolean) return kind == "constant" ? (s.value("k", 0.0) != 0 ? "true" : "false") : "time >= " + t0;
  if (kind == "constant") return k;
  if (kind == "step") return "if time >= " + t0 + " then " + k + " else 0";
  if (kind == "ramp") return "if time >= " + t0 + " then " + k + " * (time - " + t0 + ") else 0";
  if (kind == "sine") return k + " * sin(2 * 3.141592653589793 * " + num("f", 1) + " * time)";
  throw std::runtime_error("stimulus is constant, step, ramp or sine, not " + kind);
}

// The model's top-level inputs (a RealInput connector, or `input Real u`) and whether each is Boolean.
std::map<std::string, bool> top_inputs(Omc& omc, const std::string& model) {
  std::map<std::string, bool> out;
  for (const auto& c : parse_value(omc.call("getComponents(" + model + ")")).items) {
    if (c.size() < 11) continue;
    const std::string cls = c[0].atom, name = c[1].atom;
    const std::string shortcls = cls.substr(cls.rfind('.') + 1);
    const bool causal = shortcls == "RealInput" || shortcls == "IntegerInput" || shortcls == "BooleanInput";
    if (c[3].atom != "protected" && (causal || c[10].atom == "input"))
      out[name] = shortcls == "BooleanInput" || cls == "Boolean";
  }
  return out;
}

json op_simulate(Omc& omc, const json& in) {
  const std::string model = user_model(in);
  const double stop = in.value("stop", 1.0);
  if (!(stop > 0.0) || !std::isfinite(stop)) throw std::runtime_error("stop time must be above 0");

  // Top-level inputs have nothing driving them on their own: simulate a harness that holds the
  // model as `m` and feeds each input its stimulus (0 unless given), then name things as the model does.
  const auto inputs = top_inputs(omc, model);
  const json given = in.value("inputs", json::object());
  const std::string harness = "SqueroSimHarness";
  const std::string prefix = inputs.empty() ? "" : "m.";
  if (!inputs.empty()) {
    std::string text = "model " + harness + "\n  " + model + " m;\nequation\n";
    for (const auto& [name, boolean] : inputs)
      text += "  m." + name + " = " + stimulus(given.contains(name) ? given[name] : json::object(), boolean) + ";\n";
    omc.call("deleteClass(" + harness + ")");
    if (omc.call("loadString(" + quote(text + "end " + harness + ";\n") + ")") != "true")
      throw std::runtime_error("cannot build the input harness: " + omc.errors());
  }
  struct Drop {
    Omc& omc;
    std::string cls;
    ~Drop() {
      if (!cls.empty()) omc.call("deleteClass(" + cls + ")");
    }
  } drop{omc, inputs.empty() ? "" : harness};

  std::string filter;
  for (const auto& v : in.value("vars", json::array())) {
    const std::string name = prefix + v.get<std::string>();
    if (name.empty() || name.find_first_not_of("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_.[](),") != std::string::npos)
      throw std::runtime_error("not a variable name: " + name);
    std::string re;
    for (const char c : name) re += (std::string_view(".[]()").find(c) != std::string_view::npos ? "\\" : "") + std::string(1, c);
    filter += (filter.empty() ? "" : "|") + re;
  }
  std::string expr = "simulate(" + (inputs.empty() ? model : harness) + ", startTime=0, stopTime=" + std::to_string(stop) +
                     ", numberOfIntervals=500, outputFormat=\"csv\"";
  if (!filter.empty()) expr += ", variableFilter=" + quote(filter);
  const std::string answer = omc.call(expr + ")", std::chrono::minutes(5));
  const auto at = answer.find("resultFile = \"");
  std::string file;
  if (at != std::string::npos) file = answer.substr(at + 14, answer.find('"', at + 14) - at - 14);
  std::ifstream csv(file);
  std::string header;
  if (file.empty() || !std::getline(csv, header)) {
    const auto m = answer.find("messages = \"");
    std::string why = m == std::string::npos ? "" : answer.substr(m + 12, answer.find("\",\n", m) - m - 12);
    // "Failed to build model: X" says nothing; omc's first Error line says why
    const std::string errors = omc.errors();
    const auto e = errors.find("Error: ");
    const std::string cause = e == std::string::npos ? "" : errors.substr(e + 7, errors.find('\n', e) - e - 7);
    throw std::runtime_error("simulation failed: " + trim(!cause.empty() ? cause : why.empty() ? errors : why));
  }
  json names = json::array();
  std::vector<std::vector<json>> columns;
  {
    std::stringstream row(header);
    for (std::string cell; std::getline(row, cell, ',');) {
      if (cell.size() >= 2 && cell.front() == '"') cell = cell.substr(1, cell.size() - 2);
      // the harness's m.x is the model's x, der(m.x) its der(x)
      for (const std::string from : {prefix, "der(" + prefix})
        if (!prefix.empty() && cell.starts_with(from)) cell = (from.size() > prefix.size() ? "der(" : "") + cell.substr(from.size());
      names.push_back(cell);
    }
  }
  columns.resize(names.size());
  for (std::string line; std::getline(csv, line);) {
    const auto row = numbers(line);
    for (std::size_t i = 0; i < columns.size() && i < row.size(); ++i) columns[i].push_back(row[i]);
  }
  json series = json::object();
  json all = json::array();
  for (std::size_t i = 1; i < names.size(); ++i) {
    series[names[i].get<std::string>()] = columns[i];
    all.push_back(names[i]);
  }
  return {{"t", columns.empty() ? std::vector<json>{} : columns[0]}, {"series", series}, {"names", all}};
}

}  // namespace

std::string handle(Omc& omc, const std::string& message, const Session& session) {
  json in;
  try {
    in = json::parse(message);
  } catch (const json::exception&) {
    return json{{"ok", false}, {"error", "not JSON"}}.dump();
  }
  json out{{"id", in.value("id", json())}};
  const std::string op = in.value("op", "");
  try {
    if (op == "omc" && in.contains("expr") && in["expr"].is_string()) {
      const std::string expr = in["expr"];
      if (!allowed(expr)) {
        out["ok"] = false;
        out["error"] = "not allowed: " + expr.substr(0, expr.find('(')) + " (Studio may call only the squero/0 allow-list)";
        return out.dump();
      }
      out["result"] = omc.call(expr);
    } else if (op == "open") {
      out["result"] = op_open(omc, in, session);
    } else if (op == "save") {
      out["result"] = op_save(omc, in);
    } else if (op == "icon") {
      out["result"] = op_icon(omc, in);
    } else if (op == "set_icon") {
      out["result"] = op_set_icon(omc, in);
    } else if (op == "generate") {
      out["result"] = op_generate(omc, in, session);
    } else if (op == "export") {
      out["result"] = op_export(omc, in, session);
    } else if (op == "simulate") {
      out["result"] = op_simulate(omc, in);
    } else {
      out["ok"] = false;
      out["error"] = "unknown op; squero/0 has omc, open, save, icon, set_icon, generate, export, simulate";
      return out.dump();
    }
    out["ok"] = true;
  } catch (const std::exception& e) {
    out["ok"] = false;
    out["error"] = e.what();
  }
  return out.dump();
}

int serve_squero(int port, const fs::path& app, Omc::Options options, const fs::path& file) {
  ix::initNetSystem();
  Omc omc(std::move(options));
  ix::HttpServer server(port, "127.0.0.1");
  // Recursive: sending to a client that has just gone away runs its Close handler on this same
  // thread, which takes the lock again. The send loop walks a copy for the same reason.
  std::recursive_mutex mutex;
  std::set<ix::WebSocket*> clients;

  omc.on_status([&](OmcState state, const std::string& version) {
    const std::string text = status(state, version);
    std::lock_guard lock(mutex);
    for (auto* ws : std::set<ix::WebSocket*>(clients)) ws->sendText(text);
  });
  server.setOnConnectionCallback(
      [&app](const ix::HttpRequestPtr& request, const std::shared_ptr<ix::ConnectionState>&) { return http(app, request); });
  server.setOnClientMessageCallback(
      [&](std::shared_ptr<ix::ConnectionState>, ix::WebSocket& ws, const ix::WebSocketMessagePtr& msg) {
        if (msg->type == ix::WebSocketMessageType::Open) {
          {
            std::lock_guard lock(mutex);
            clients.insert(&ws);
          }
          ws.sendText(status(omc.state(), omc.version()));
        } else if (msg->type == ix::WebSocketMessageType::Close) {
          std::lock_guard lock(mutex);
          clients.erase(&ws);
        } else if (msg->type == ix::WebSocketMessageType::Message) {
          // Each connection has its own callback thread; omc serialises the calls.
          const Session session{[&ws](const std::string& text) { ws.sendText(text); }, file};
          if (std::string reply = handle(omc, msg->str, session); !reply.empty()) ws.sendText(reply);
        }
      });
  if (auto [ok, error] = server.listen(); !ok) {
    std::cerr << "cannot listen on port " << port << ": " << error << '\n';
    return 1;
  }
  server.start();
  std::cout << "squero studio OM server (squero/0) on ws://localhost:" << port
            << (app.empty() ? std::string() : "  app: http://localhost:" + std::to_string(port) + "/") << std::endl;
  // Start omc now so the first status a client sees is real.
  try {
    omc.call("getVersion()");
  } catch (const std::exception& e) {
    std::cerr << "omc: " << e.what() << '\n';
  }
  for (;;) std::this_thread::sleep_for(std::chrono::hours(1));
}

}  // namespace squero
