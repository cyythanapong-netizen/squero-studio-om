// Syntax highlighter for Modelica (.mo) and C++ source panels.
// Produces tokenized lines with Geist Mono and Paperboat design token classes.

export type TokenType =
  | "plain"
  | "keyword"
  | "type"
  | "comment"
  | "string"
  | "number"
  | "boolean"
  | "operator"
  | "preprocessor"
  | "annotation";

export type Token = {
  type: TokenType;
  text: string;
};

const MO_KEYWORDS = new Set([
  "model", "block", "connector", "package", "end", "parameter", "constant",
  "input", "output", "equation", "algorithm", "connect", "annotation",
  "extends", "import", "der", "initial", "record", "function", "type",
  "class", "pure", "impure", "within", "final", "encapsulated", "partial",
  "replaceable", "redeclare", "each", "flow", "stream", "discrete",
  "when", "elsewhen", "if", "then", "else", "elseif", "for", "in", "loop", "while",
  "break", "return", "external",
]);

const MO_TYPES = new Set(["Real", "Integer", "Boolean", "String"]);

const CPP_KEYWORDS = new Set([
  "alignas", "alignof", "and", "and_eq", "asm", "atomic_cancel", "atomic_commit",
  "atomic_noexcept", "auto", "bitand", "bitor", "break", "case", "catch",
  "class", "compl", "concept", "const", "consteval", "constexpr", "constinit",
  "const_cast", "continue", "co_await", "co_return", "co_yield", "decltype",
  "default", "delete", "do", "dynamic_cast", "else", "enum", "explicit",
  "export", "extern", "false", "for", "friend", "goto", "if", "inline",
  "mutable", "namespace", "new", "noexcept", "not", "not_eq", "nullptr",
  "operator", "or", "or_eq", "private", "protected", "public", "reflexpr",
  "register", "reinterpret_cast", "requires", "return", "sizeof", "static",
  "static_assert", "static_cast", "struct", "switch", "synchronized", "template",
  "this", "thread_local", "throw", "true", "try", "typedef", "typeid",
  "typename", "union", "using", "virtual", "volatile", "while", "xor", "xor_eq",
  "override", "final",
]);

const CPP_TYPES = new Set([
  "void", "bool", "char", "char8_t", "char16_t", "char32_t", "wchar_t",
  "short", "int", "long", "float", "double", "signed", "unsigned",
  "std", "string", "string_view", "vector", "map", "set", "unordered_map",
  "unordered_set", "array", "pair", "tuple", "unique_ptr", "shared_ptr",
  "size_t", "int8_t", "int16_t", "int32_t", "int64_t", "uint8_t", "uint16_t",
  "uint32_t", "uint64_t", "intptr_t", "uintptr_t", "ptrdiff_t",
]);

/**
 * Tokenizes source text line-by-line for syntax highlighting.
 * Correctly tracks multi-line block comments across lines.
 */
export function tokenize(source: string, lang: "mo" | "cpp"): Token[][] {
  const lines = source.split(/\r?\n/);
  const result: Token[][] = [];
  let inBlockComment = false;

  for (const line of lines) {
    const lineTokens: Token[] = [];
    let i = 0;
    const len = line.length;

    while (i < len) {
      if (inBlockComment) {
        const closeIdx = line.indexOf("*/", i);
        if (closeIdx === -1) {
          lineTokens.push({ type: "comment", text: line.slice(i) });
          i = len;
        } else {
          lineTokens.push({ type: "comment", text: line.slice(i, closeIdx + 2) });
          i = closeIdx + 2;
          inBlockComment = false;
        }
        continue;
      }

      // Check for start of block comment /*
      if (line.startsWith("/*", i)) {
        const closeIdx = line.indexOf("*/", i + 2);
        if (closeIdx === -1) {
          lineTokens.push({ type: "comment", text: line.slice(i) });
          i = len;
          inBlockComment = true;
        } else {
          lineTokens.push({ type: "comment", text: line.slice(i, closeIdx + 2) });
          i = closeIdx + 2;
        }
        continue;
      }

      // Check for line comment //
      if (line.startsWith("//", i)) {
        lineTokens.push({ type: "comment", text: line.slice(i) });
        i = len;
        continue;
      }

      // Preprocessor directives in C++ (at start of trimmed line)
      if (lang === "cpp" && line.slice(i).trimStart().startsWith("#")) {
        const hashIdx = line.indexOf("#", i);
        if (hashIdx === i) {
          lineTokens.push({ type: "preprocessor", text: line.slice(i) });
          i = len;
          continue;
        }
      }

      // String literal "..."
      if (line[i] === '"') {
        let j = i + 1;
        while (j < len && line[j] !== '"') {
          if (line[j] === "\\") j += 2;
          else j++;
        }
        if (j < len && line[j] === '"') j++;
        lineTokens.push({ type: "string", text: line.slice(i, j) });
        i = j;
        continue;
      }

      // Char literal '...' (in C++)
      if (lang === "cpp" && line[i] === "'") {
        let j = i + 1;
        while (j < len && line[j] !== "'") {
          if (line[j] === "\\") j += 2;
          else j++;
        }
        if (j < len && line[j] === "'") j++;
        lineTokens.push({ type: "string", text: line.slice(i, j) });
        i = j;
        continue;
      }

      // Number literal
      if (
        /\d/.test(line[i]) ||
        (line[i] === "." && i + 1 < len && /\d/.test(line[i + 1]))
      ) {
        let j = i;
        if (line.slice(j).startsWith("0x") || line.slice(j).startsWith("0X")) {
          j += 2;
          while (j < len && /[0-9a-fA-F]/.test(line[j])) j++;
        } else {
          while (j < len && /[\d.]/.test(line[j])) j++;
          if (j < len && (line[j] === "e" || line[j] === "E")) {
            j++;
            if (j < len && (line[j] === "+" || line[j] === "-")) j++;
            while (j < len && /\d/.test(line[j])) j++;
          }
          if (lang === "cpp" && j < len && /[fFlLuU]/.test(line[j])) {
            while (j < len && /[fFlLuU]/.test(line[j])) j++;
          }
        }
        lineTokens.push({ type: "number", text: line.slice(i, j) });
        i = j;
        continue;
      }

      // Identifier or Keyword
      if (/[a-zA-Z_]/.test(line[i])) {
        let j = i;
        while (j < len && /[a-zA-Z0-9_]/.test(line[j])) j++;
        const word = line.slice(i, j);

        if (word === "true" || word === "false") {
          lineTokens.push({ type: "boolean", text: word });
        } else if (lang === "mo") {
          if (word === "initial") {
            const rest = line.slice(j).trimStart();
            if (rest.startsWith("equation")) {
              const spaces = line.slice(j, j + (line.slice(j).length - rest.length));
              lineTokens.push({ type: "keyword", text: word + spaces + "equation" });
              i = j + (line.slice(j).length - rest.length) + "equation".length;
              continue;
            }
          }
          if (MO_KEYWORDS.has(word)) {
            lineTokens.push({ type: word === "annotation" ? "annotation" : "keyword", text: word });
          } else if (MO_TYPES.has(word)) {
            lineTokens.push({ type: "type", text: word });
          } else {
            lineTokens.push({ type: "plain", text: word });
          }
        } else {
          // C++
          if (CPP_KEYWORDS.has(word)) {
            lineTokens.push({ type: "keyword", text: word });
          } else if (CPP_TYPES.has(word)) {
            lineTokens.push({ type: "type", text: word });
          } else {
            lineTokens.push({ type: "plain", text: word });
          }
        }
        i = j;
        continue;
      }

      // Operators and punctuation
      if (/[=+\-*/^<>!&|%:;,?~]/.test(line[i])) {
        let j = i;
        while (j < len && /[=+\-*/^<>!&|%:;,?~]/.test(line[j])) j++;
        lineTokens.push({ type: "operator", text: line.slice(i, j) });
        i = j;
        continue;
      }

      // Brackets and delimiters
      if (/[()[\]{}]/.test(line[i])) {
        lineTokens.push({ type: "operator", text: line[i] });
        i++;
        continue;
      }

      // Other whitespace / text
      let j = i;
      while (
        j < len &&
        !inBlockComment &&
        !line.startsWith("/*", j) &&
        !line.startsWith("//", j) &&
        line[j] !== '"' &&
        !(lang === "cpp" && line[j] === "'") &&
        !/\d/.test(line[j]) &&
        !(line[j] === "." && j + 1 < len && /\d/.test(line[j + 1])) &&
        !/[a-zA-Z_]/.test(line[j]) &&
        !/[=+\-*/^<>!&|%:;,?~]/.test(line[j]) &&
        !/[()[\]{}]/.test(line[j])
      ) {
        j++;
      }
      lineTokens.push({ type: "plain", text: line.slice(i, j) });
      i = j;
    }

    result.push(lineTokens);
  }

  return result;
}
