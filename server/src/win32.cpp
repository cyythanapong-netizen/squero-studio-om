// Processes, libraries and the environment on Windows (see squero/win32.hpp).
#ifdef _WIN32

#include "squero/win32.hpp"

#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>

#include <algorithm>
#include <cstdlib>
#include <map>
#include <mutex>

namespace squero::win32 {
namespace {

namespace fs = std::filesystem;

// UTF-8 when it is (JSON, the web app), else the ANSI code page (std::filesystem::path::string()).
std::wstring widen(const std::string& s) {
  if (s.empty()) return {};
  for (const UINT cp : {static_cast<UINT>(CP_UTF8), static_cast<UINT>(CP_ACP)}) {
    const DWORD flags = cp == CP_UTF8 ? MB_ERR_INVALID_CHARS : 0;
    const int n = MultiByteToWideChar(cp, flags, s.data(), static_cast<int>(s.size()), nullptr, 0);
    if (n <= 0) continue;
    std::wstring w(static_cast<std::size_t>(n), L'\0');
    MultiByteToWideChar(cp, flags, s.data(), static_cast<int>(s.size()), w.data(), n);
    return w;
  }
  return {};
}

// One argument as CommandLineToArgvW reads it back.
void append_quoted(std::wstring& out, const std::wstring& arg) {
  if (!arg.empty() && arg.find_first_of(L" \t\n\v\"") == std::wstring::npos) {
    out += arg;
    return;
  }
  out += L'"';
  for (auto it = arg.begin();; ++it) {
    std::size_t backslashes = 0;
    while (it != arg.end() && *it == L'\\') {
      ++it;
      ++backslashes;
    }
    if (it == arg.end()) {
      out.append(backslashes * 2, L'\\');
      break;
    }
    if (*it == L'"') {
      out.append(backslashes * 2 + 1, L'\\');
      out += L'"';
    } else {
      out.append(backslashes, L'\\');
      out += *it;
    }
  }
  out += L'"';
}

// argv[0] as CreateProcess can run it: an .exe as is; a .cmd or .bat through cmd.exe.
std::vector<std::string> runnable(std::vector<std::string> argv) {
  fs::path program(widen(argv[0]));
  if (!program.has_parent_path()) {
    if (const std::string found = which(argv[0]); !found.empty()) program = fs::path(widen(found));
  }
  std::wstring ext = program.extension().wstring();
  std::transform(ext.begin(), ext.end(), ext.begin(), [](wchar_t c) { return static_cast<wchar_t>(::towlower(c)); });
  argv[0] = program.string();
  if (ext == L".cmd" || ext == L".bat") argv.insert(argv.begin(), {"cmd.exe", "/c"});
  return argv;
}

HANDLE open_nul(DWORD access) {
  SECURITY_ATTRIBUTES sa{sizeof(sa), nullptr, TRUE};
  return CreateFileW(L"NUL", access, FILE_SHARE_READ | FILE_SHARE_WRITE, &sa, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
}

struct Entry {
  HANDLE process = nullptr;
  HANDLE job = nullptr;
};
std::mutex registry_mutex;
std::map<int, Entry> registry;

// CreateProcess with exactly `in`, `out` and `err` inherited (PROC_THREAD_ATTRIBUTE_HANDLE_LIST),
// in a new job, suspended until it is in it.
int create(const std::vector<std::string>& args, const fs::path& cwd, HANDLE in, HANDLE out, HANDLE err, bool die_with_us) {
  const std::vector<std::string> argv = runnable(args);
  std::wstring line;
  for (const auto& a : argv) {
    if (!line.empty()) line += L' ';
    append_quoted(line, widen(a));
  }
  std::vector<HANDLE> inherit;
  for (HANDLE h : {in, out, err})
    if (h && h != INVALID_HANDLE_VALUE && std::find(inherit.begin(), inherit.end(), h) == inherit.end()) inherit.push_back(h);
  SIZE_T size = 0;
  InitializeProcThreadAttributeList(nullptr, 1, 0, &size);
  std::vector<char> storage(size);
  auto* attrs = reinterpret_cast<LPPROC_THREAD_ATTRIBUTE_LIST>(storage.data());
  if (!InitializeProcThreadAttributeList(attrs, 1, 0, &size)) return -1;
  UpdateProcThreadAttribute(attrs, 0, PROC_THREAD_ATTRIBUTE_HANDLE_LIST, inherit.data(), inherit.size() * sizeof(HANDLE), nullptr, nullptr);

  STARTUPINFOEXW si{};
  si.StartupInfo.cb = sizeof(si);
  si.StartupInfo.dwFlags = STARTF_USESTDHANDLES;
  si.StartupInfo.hStdInput = in;
  si.StartupInfo.hStdOutput = out;
  si.StartupInfo.hStdError = err;
  si.lpAttributeList = attrs;
  PROCESS_INFORMATION pi{};
  const std::wstring dir = cwd.empty() ? std::wstring{} : cwd.wstring();
  const BOOL ok = CreateProcessW(nullptr, line.data(), nullptr, nullptr, TRUE,
                                 CREATE_SUSPENDED | CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP | CREATE_UNICODE_ENVIRONMENT |
                                     EXTENDED_STARTUPINFO_PRESENT,
                                 nullptr, dir.empty() ? nullptr : dir.c_str(), &si.StartupInfo, &pi);
  DeleteProcThreadAttributeList(attrs);
  if (!ok) return -1;
  Entry e{pi.hProcess, CreateJobObjectW(nullptr, nullptr)};
  if (e.job) {
    if (die_with_us) {
      JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits{};
      limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
      SetInformationJobObject(e.job, JobObjectExtendedLimitInformation, &limits, sizeof(limits));
    }
    AssignProcessToJobObject(e.job, pi.hProcess);
  }
  ResumeThread(pi.hThread);
  CloseHandle(pi.hThread);
  const int pid = static_cast<int>(pi.dwProcessId);
  std::lock_guard lock(registry_mutex);
  registry[pid] = e;
  return pid;
}

Entry find(int pid) {
  std::lock_guard lock(registry_mutex);
  const auto it = registry.find(pid);
  return it == registry.end() ? Entry{} : it->second;
}

}  // namespace

int spawn(const std::vector<std::string>& argv, const fs::path& cwd, const fs::path& out, Err err, bool die_with_us) {
  SECURITY_ATTRIBUTES sa{sizeof(sa), nullptr, TRUE};
  HANDLE in = open_nul(GENERIC_READ);
  HANDLE o = out.empty() ? open_nul(GENERIC_WRITE)
                         : CreateFileW(out.wstring().c_str(), GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, &sa,
                                       CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
  HANDLE e = o;
  if (err == Err::Null) {
    e = open_nul(GENERIC_WRITE);
  } else if (err == Err::Inherit) {
    HANDLE own = GetStdHandle(STD_ERROR_HANDLE);
    if (!own || own == INVALID_HANDLE_VALUE ||
        !DuplicateHandle(GetCurrentProcess(), own, GetCurrentProcess(), &e, 0, TRUE, DUPLICATE_SAME_ACCESS))
      e = open_nul(GENERIC_WRITE);
  }
  const int pid = o == INVALID_HANDLE_VALUE ? -1 : create(argv, cwd, in, o, e, die_with_us);
  std::vector<HANDLE> opened;  // the child has its copies: close ours, each once (err may be out)
  for (HANDLE h : {in, o, e})
    if (h && h != INVALID_HANDLE_VALUE && std::find(opened.begin(), opened.end(), h) == opened.end()) opened.push_back(h);
  for (HANDLE h : opened) CloseHandle(h);
  return pid;
}

int spawn_piped(const std::vector<std::string>& argv, void** read_end) {
  SECURITY_ATTRIBUTES sa{sizeof(sa), nullptr, TRUE};
  HANDLE r = nullptr, w = nullptr;
  if (!CreatePipe(&r, &w, &sa, 0)) return -1;
  SetHandleInformation(r, HANDLE_FLAG_INHERIT, 0);
  HANDLE in = open_nul(GENERIC_READ);
  const int pid = create(argv, {}, in, w, w, false);
  CloseHandle(in);
  CloseHandle(w);
  if (pid < 0) {
    CloseHandle(r);
    return -1;
  }
  *read_end = r;
  return pid;
}

bool read_pipe(void* read_end, std::string& chunk) {
  char buf[8192];
  DWORD n = 0;
  if (!ReadFile(static_cast<HANDLE>(read_end), buf, sizeof buf, &n, nullptr) || n == 0) return false;
  chunk.assign(buf, n);
  return true;
}

void close_pipe(void* read_end) { CloseHandle(static_cast<HANDLE>(read_end)); }

bool running(int pid) {
  const Entry e = find(pid);
  return e.process && WaitForSingleObject(e.process, 0) == WAIT_TIMEOUT;
}

int wait(int pid) {
  Entry e;
  {
    std::lock_guard lock(registry_mutex);
    const auto it = registry.find(pid);
    if (it == registry.end()) return -1;
    e = it->second;
    registry.erase(it);
  }
  WaitForSingleObject(e.process, INFINITE);
  DWORD code = 0;
  GetExitCodeProcess(e.process, &code);
  CloseHandle(e.process);
  if (e.job) CloseHandle(e.job);  // a die-with-us job ends what is left in it
  return static_cast<int>(code);
}

void kill_tree(int pid) {
  const Entry e = find(pid);
  if (e.job) TerminateJobObject(e.job, 143);
  else if (e.process) TerminateProcess(e.process, 143);
}

int current_pid() { return static_cast<int>(GetCurrentProcessId()); }

fs::path exe_path() {
  std::wstring buf(MAX_PATH, L'\0');
  for (;;) {
    const DWORD n = GetModuleFileNameW(nullptr, buf.data(), static_cast<DWORD>(buf.size()));
    if (n < buf.size()) {
      buf.resize(n);
      return fs::path(buf);
    }
    buf.resize(buf.size() * 2);
  }
}

std::string which(const std::string& name) {
  const std::wstring w = widen(name);
  std::vector<std::wstring> exts = {L""};
  if (fs::path(w).extension().empty()) {
    const char* pathext = std::getenv("PATHEXT");
    std::wstring list = widen(pathext ? pathext : ".COM;.EXE;.BAT;.CMD");
    for (std::size_t at = 0; at <= list.size();) {
      const std::size_t semi = std::min(list.find(L';', at), list.size());
      if (semi > at) exts.push_back(list.substr(at, semi - at));
      at = semi + 1;
    }
    exts.erase(exts.begin());  // a bare name with no extension is not a Windows program
  }
  for (const auto& ext : exts) {
    wchar_t found[MAX_PATH];
    if (SearchPathW(nullptr, (w + ext).c_str(), nullptr, MAX_PATH, found, nullptr) != 0) return fs::path(found).string();
  }
  return "";
}

void set_env(const std::string& name, const std::string& value) { _putenv_s(name.c_str(), value.c_str()); }

void* load_library(const fs::path& path) {
  return LoadLibraryExW(path.wstring().c_str(), nullptr, LOAD_WITH_ALTERED_SEARCH_PATH);
}

void* symbol(void* library, const char* name) {
  return reinterpret_cast<void*>(GetProcAddress(static_cast<HMODULE>(library), name));
}

}  // namespace squero::win32

#endif
