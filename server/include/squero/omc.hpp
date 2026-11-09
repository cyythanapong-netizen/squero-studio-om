#pragma once

// The OpenModelica compiler as a long-lived process (#160 contracts §5): one
// `omc --interactive=zmq -z=<session>` per Omc, spoken to over ZeroMQ REQ/REP. One request
// in flight at a time; a request that times out or finds omc dead restarts it (replaying the
// libraries and files it had loaded), and after 3 restarts in a row the bridge is `failed`.
//
// libzmq is opened at run time (libzmq.so.5, which omc itself ships), so building this needs
// no ZeroMQ headers; only running it needs omc.

#include <chrono>
#include <functional>
#include <memory>
#include <stdexcept>
#include <string>
#include <string_view>
#include <vector>

namespace squero {

struct OmcError : std::runtime_error {
  using std::runtime_error::runtime_error;
};

enum class OmcState { Ready, Checking, Failed };
std::string_view name(OmcState state);  // "ready", "checking", "failed"

/** One of omc's messages, split into the level, the prose and the source span omc gave. */
struct OmcMessage {
  std::string level;   // error | warning | info
  std::string text;
  std::string file;
  int line = 0;
  int column = 0;
};

class Omc {
 public:
  struct Options {
    std::string omc = "";                             // the executable; empty: resolve_omc() picks one
    std::chrono::milliseconds timeout{30'000};        // per request
    int max_restarts = 3;                             // in a row, then failed
  };
  using StatusFn = std::function<void(OmcState, const std::string& version)>;
  using LogFn = std::function<void(const OmcMessage&)>;

  Omc();
  explicit Omc(Options options);
  ~Omc();
  Omc(const Omc&) = delete;
  Omc& operator=(const Omc&) = delete;

  // Evaluates one omc expression, e.g. `checkModel(M)`, and returns omc's answer as text
  // (`true`, `"…"`, `{…}`), without the trailing newline. Starts omc on first use. Throws
  // OmcError when omc can't start, or failed (OmcState::Failed).
  std::string call(std::string_view expr);
  std::string call(std::string_view expr, std::chrono::milliseconds timeout);

  // `getErrorString()` unquoted: what omc said about the calls since the last one. Drains omc's
  // buffer, so it is also what the log callback hears.
  std::string errors();

  // Drains omc's messages and returns them split by level and source. The same list is kept for
  // `last_messages()` and read by `getErrorString()` clients.
  std::vector<OmcMessage> messages();
  // The messages from the last drain, without asking omc again.
  std::vector<OmcMessage> last_messages() const;
  // `getErrorString()` as the last drain saw it; clears the cache (a client's read).
  std::string take_errors();
  // Forgets the last drain, so a new operation starts with a clean read.
  void clear_messages();

  OmcState state() const;
  std::string version() const;  // "OpenModelica 1.27…" once started, else ""
  // Called (from the calling thread) on every state change.
  void on_status(StatusFn fn);
  // Called for each drained message, in order, so a server can stream omc's log.
  void on_log(LogFn fn);

  // The folder omc runs in (its build output and dumps land here).
  std::string workdir() const;
  // How omc runs: "native", "podman" or "docker" (resolve_omc()).
  std::string mode() const;

 private:
  struct Impl;
  std::unique_ptr<Impl> impl_;
};

// Where omc comes from (#2), first that holds:
//   1. $SQUERO_OMC_BIN or $PAPERBOAT_OMC_BIN;
//   2. `omc` on PATH whose install can build FMUs (its runtime files are readable);
//   3. podman, else docker: kImage with the host's /tmp and $HOME at the same paths, as the
//      user (keep-id / --user), no SELinux relabel (label=disable), host network for omc's
//      ZeroMQ port; pulled on first use;
//   4. `omc` on PATH anyway, with `why` saying what's wrong with it.
// $SQUERO_OMC=native|podman|docker forces one.
inline constexpr const char* kImage = "docker.io/openmodelica/openmodelica:v1.27.1-minimal";
struct OmcRuntime {
  std::string mode;              // native | podman | docker
  std::string exe;               // omc, or the container engine
  std::string why;               // why not the better choice, or ""
};
OmcRuntime resolve_omc();
// The argv that starts omc under `rt`, in `workdir`, with omc's own `args`.
std::vector<std::string> omc_command(const OmcRuntime& rt, const std::string& workdir, const std::vector<std::string>& args);

// Whether `expr` may come from a Studio client over squero/0: one call to a function on the
// allow-list (contracts §5), whose nested calls are allow-listed too or are annotation
// records (capitalised: Placement(…), Line(…)) or their `transformation`s. No `;`, no `:=`.
bool allowed(std::string_view expr);
const std::vector<std::string>& allowed_calls();

// omc's answers, parsed: `{a, "b", {c}}` → a list of atoms and lists. Strings keep their
// unescaped text; other atoms their spelling (`true`, `1.5`, `Modelica.Blocks`).
struct OmValue {
  bool is_list = false;
  bool is_string = false;
  std::string atom;
  std::vector<OmValue> items;

  const OmValue& operator[](std::size_t i) const { return items.at(i); }
  std::size_t size() const { return items.size(); }
};
OmValue parse_value(std::string_view text);  // throws OmcError on malformed text
std::string quote(std::string_view text);    // a Modelica string literal

}  // namespace squero

namespace paperboat::modelica {
using namespace squero;
}

