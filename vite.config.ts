import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server only; `squero-om` serves the built dist/ and squero/0 on 59201+.
// dedupe: @paperboat/shared is a linked sibling with its own node_modules; keep one React (and one three).
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: [
      "react", "react-dom", "@xyflow/react", "three",
      // The shared editor is CodeMirror: one copy of each, or its extensions do not match.
      "@codemirror/state", "@codemirror/view", "@codemirror/language", "@codemirror/commands",
      "@codemirror/autocomplete", "@codemirror/lint", "@codemirror/merge", "@lezer/highlight",
    ],
  },
  build: { chunkSizeWarningLimit: 800 },
  server: {
    port: 3048,
    fs: {
      allow: [".."],
    },
  },
  preview: { port: 3048 },
});
