#include <cstdlib>
#include <filesystem>
#include <iostream>
#include <string>
#include <string_view>
#include <vector>

#include <nlohmann/json.hpp>

#include "squero/generate.hpp"
#include "squero/import.hpp"
#include "squero/omc.hpp"
#include "squero/squero.hpp"

namespace fs = std::filesystem;
namespace mo = squero;

#ifndef SQUERO_VERSION
#define SQUERO_VERSION "0.1.0"
#endif

namespace {

void print_help(std::string_view prog) {
  std::cout << "Squero Studio OM (" << SQUERO_VERSION << "): Modelica editor server & tools\n\n"
            << "Usage:\n"
            << "  " << prog << " [Model.mo] [options]                 Run Studio OM (squero/0 server & web app)\n"
            << "  " << prog << " generate <Model.mo> [options]        Make a Paperboat backend from Modelica\n"
            << "  " << prog << " check <Model.mo> [--model <Name>]    omc's checkModel on Modelica model\n"
            << "  " << prog << " icon <Model.mo|Name> [--class <Name>] Import icon & connectors as JSON\n"
            << "  " << prog << " --help | --version\n\n"
            << "Server options:\n"
            << "  --port <N>       Listen port (default: 8790)\n"
            << "  --app <dir>      Directory of built web app (default: ./dist)\n"
            << "  --version <V>    Target version tag\n\n"
            << "Generate options:\n"
            << "  --model <Name>   Qualified Modelica model name inside file\n"
            << "  --out <dir>      Output backend directory (default: <model>-cpp/)\n"
            << "  --path <path>    ode | fmu | auto (default: auto)\n";
}

int cmd_icon(const std::vector<std::string_view>& args) {
  if (args.empty()) {
    std::cerr << "error: icon requires a file (.mo) or a qualified Modelica class name\n";
    return 2;
  }
  const std::string_view target = args[0];
  std::string cls;
  for (std::size_t i = 1; i < args.size(); ++i) {
    const auto flag = args[i];
    if (flag == "--json") continue;
    if (i + 1 >= args.size()) {
      std::cerr << "error: " << flag << " needs a value\n";
      return 2;
    }
    const std::string value(args[++i]);
    if (flag == "--class" || flag == "--model") cls = value;
    else {
      std::cerr << "error: unknown option " << flag << '\n';
      return 2;
    }
  }
  try {
    mo::Omc omc;
    const bool is_file = fs::is_regular_file(target) || target.ends_with(".mo") ||
                         target.find('/') != std::string_view::npos || target.find('\\') != std::string_view::npos;
    const mo::ImportedModel imp = is_file ? mo::import_model(omc, fs::path(target), cls)
                                          : mo::import_model(omc, {}, cls.empty() ? target : std::string_view(cls));
    std::cout << imp.to_json().dump(2) << '\n';
    return 0;
  } catch (const std::exception& e) {
    std::cerr << "error: " << e.what() << '\n';
    return 1;
  }
}

int cmd_check_or_generate(std::string_view action, const std::vector<std::string_view>& args) {
  if (args.empty()) {
    std::cerr << "error: " << action << " requires a Modelica source file (.mo)\n";
    return 2;
  }
  if (args[0] == "--help" || args[0] == "-h") {
    print_help("squero-om");
    return 0;
  }
  mo::GenerateOptions o{.source = std::string(args[0])};
  for (std::size_t i = 1; i < args.size(); ++i) {
    const auto flag = args[i];
    if (flag == "--help" || flag == "-h") {
      print_help("squero-om");
      return 0;
    }
    if (i + 1 >= args.size()) {
      std::cerr << "error: " << flag << " needs a value\n";
      return 2;
    }
    const std::string value(args[++i]);
    if (flag == "--model" || flag == "-m") o.model = value;
    else if (flag == "--out" || flag == "-o") o.out = value;
    else if (flag == "--path" || flag == "-p") o.path = value;
    else {
      std::cerr << "error: unknown option " << flag << '\n';
      return 2;
    }
  }
  try {
    mo::Omc omc;
    if (action == "check") {
      const auto r = mo::check(omc, o.source, o.model);
      (r.ok ? std::cout : std::cerr) << r.message << '\n';
      return r.ok ? 0 : 1;
    }
    const auto r = mo::generate(omc, o);
    std::cout << r.model << " -> " << r.out.string() << "/ (" << r.reason << ")\n";
    for (const auto& n : r.notices) std::cout << "  note: " << n << '\n';
    for (const auto& f : r.written) std::cout << "  wrote " << f.string() << '\n';
    std::cout << "next: paperboat build " << r.out.string() << " && paperboat run " << r.out.string() << '\n';
    return 0;
  } catch (const std::exception& e) {
    std::cerr << "error: " << e.what() << '\n';
    return 1;
  }
}

fs::path find_app_dir(const fs::path& explicit_app, const fs::path& exe_dir) {
  if (!explicit_app.empty()) return explicit_app;
  std::error_code ec;
  for (const auto& cand : {
           exe_dir / "dist",
           exe_dir.parent_path() / "dist",
           exe_dir.parent_path().parent_path() / "dist",
           fs::current_path() / "dist",
       }) {
    if (fs::is_regular_file(cand / "index.html", ec)) return cand;
  }
  return {};
}

int cmd_server(const std::vector<std::string_view>& args, const fs::path& exe_dir) {
  int port = 8790;
  fs::path app;
  fs::path file;
  for (std::size_t i = 0; i < args.size(); ++i) {
    if (args[i] == "--port" && i + 1 < args.size()) {
      port = std::stoi(std::string(args[++i]));
    } else if (args[i] == "--app" && i + 1 < args.size()) {
      app = std::string(args[++i]);
    } else if (args[i] == "--version" && i + 1 < args.size()) {
      ++i;  // Ignored in direct server mode
    } else if (i == 0 && (args[i] == "start" || args[i] == "run")) {
      continue;
    } else if (!args[i].starts_with("--")) {
      file = std::string(args[i]);
    }
  }

  app = find_app_dir(app, exe_dir);
  if (app.empty()) {
    std::cerr << "note: Studio dist/ not found; serving squero/0 only\n";
  }

  return mo::serve_squero(port, app, {}, file);
}

}  // namespace

int main(int argc, char** argv) {
  std::vector<std::string_view> args;
  for (int i = 1; i < argc; ++i) args.emplace_back(argv[i]);

  const fs::path exe_dir = fs::weakly_canonical(fs::path(argv[0])).parent_path();

  if (!args.empty()) {
    if (args[0] == "--help" || args[0] == "-h" || args[0] == "help") {
      print_help(argv[0]);
      return 0;
    }
    if (args[0] == "--version" || args[0] == "-v") {
      std::cout << "squero-om " << SQUERO_VERSION << '\n';
      return 0;
    }
    if (args[0] == "generate" || args[0] == "check") {
      std::vector<std::string_view> sub_args(args.begin() + 1, args.end());
      return cmd_check_or_generate(args[0], sub_args);
    }
    if (args[0] == "icon") {
      std::vector<std::string_view> sub_args(args.begin() + 1, args.end());
      return cmd_icon(sub_args);
    }
  }

  return cmd_server(args, exe_dir);
}
