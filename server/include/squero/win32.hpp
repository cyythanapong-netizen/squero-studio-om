#pragma once
// What the server does with processes, libraries and the environment, on Windows. The POSIX code
// (fork/exec/waitpid, dlopen, setsid) stays where it is; each place has a _WIN32 branch calling
// these. Processes are known by pid, as on POSIX: the module keeps each one's handle and job.
#ifdef _WIN32

#include <filesystem>
#include <string>
#include <vector>

namespace squero::win32 {

enum class Err { Same, Null, Inherit };  // stderr: with stdout, to NUL, or the server's own

// Starts argv[0] (a path, or a name looked up on PATH) in `cwd`. stdin is NUL; stdout goes to
// `out` (created or truncated; empty: NUL). The child gets these handles and no others. In a job
// of its own, so kill_tree ends what it starts too; with `die_with_us` the job ends when this
// process does, however it ends (prctl's PDEATHSIG on Linux). Returns the pid, or -1.
int spawn(const std::vector<std::string>& argv, const std::filesystem::path& cwd, const std::filesystem::path& out, Err err,
          bool die_with_us);
// The same with stdout and stderr into a pipe; `read_end` is its read end (a HANDLE), -1 on failure.
int spawn_piped(const std::vector<std::string>& argv, void** read_end);
// Reads the pipe until it closes, a chunk at a time; false on a read error.
bool read_pipe(void* read_end, std::string& chunk);
void close_pipe(void* read_end);

bool running(int pid);    // false once it has exited (or is not ours)
int wait(int pid);        // its exit code (blocks), and forgets it; -1 when not ours
void kill_tree(int pid);  // it and everything it started; then wait() reaps it

int current_pid();
std::filesystem::path exe_path();
std::string which(const std::string& name);  // PATH with PATHEXT, else ""
void set_env(const std::string& name, const std::string& value);

void* load_library(const std::filesystem::path& path);  // with its folder searched for its own DLLs
void* symbol(void* library, const char* name);

}  // namespace squero::win32

#endif
