// Modelica for the shared editor: a CodeMirror stream parser
// (keywords, the four builtin types, // and /* */ comments, strings, numbers, true/false).
import { StreamLanguage, type StreamParser } from "@codemirror/language";

const KEYWORDS = new Set([
  "model", "block", "connector", "package", "end", "parameter", "constant",
  "input", "output", "equation", "algorithm", "connect", "annotation",
  "extends", "import", "der", "initial", "record", "function", "type",
  "class", "pure", "impure", "within", "final", "encapsulated", "partial",
  "replaceable", "redeclare", "each", "flow", "stream", "discrete",
  "when", "elsewhen", "if", "then", "else", "elseif", "for", "in", "loop", "while",
  "break", "return", "external", "and", "or", "not", "protected", "public", "inner", "outer",
]);
const TYPES = new Set(["Real", "Integer", "Boolean", "String"]);

type State = { comment: boolean };

const parser: StreamParser<State> = {
  name: "modelica",
  startState: () => ({ comment: false }),
  token(stream, state) {
    if (state.comment) {
      if (stream.skipTo("*/")) { stream.pos += 2; state.comment = false; } else stream.skipToEnd();
      return "comment";
    }
    if (stream.eatSpace()) return null;
    if (stream.match("//")) { stream.skipToEnd(); return "comment"; }
    if (stream.match("/*")) { state.comment = true; return this.token!(stream, state); }
    if (stream.peek() === '"') {
      stream.next();
      let escaped = false;
      for (let ch = stream.next(); ch != null; ch = stream.next()) {
        if (ch === '"' && !escaped) break;
        escaped = !escaped && ch === "\\";
      }
      return "string";
    }
    if (stream.match(/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/)) return "number";
    if (stream.match(/^[A-Za-z_][A-Za-z0-9_]*/)) {
      const word = stream.current();
      if (word === "true" || word === "false") return "bool";
      if (TYPES.has(word)) return "typeName";
      if (KEYWORDS.has(word)) return "keyword";
      return "variableName";
    }
    if (stream.match(/^(?:[-+*/^=<>:;,.]|<>|<=|>=|==|:=)/)) return "operator";
    stream.next();
    return null;
  },
  languageData: { commentTokens: { line: "//", block: { open: "/*", close: "*/" } } },
};

export const modelicaParser = parser;
export const modelica = StreamLanguage.define(parser);
