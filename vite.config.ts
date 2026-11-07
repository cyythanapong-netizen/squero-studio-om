import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server only; `squero-om` serves the built dist/ and squero/0 on 8790.
// dedupe: @paperboat/shared is a linked sibling with its own node_modules; keep one React.
export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ["react", "react-dom", "@xyflow/react"] },
  build: { chunkSizeWarningLimit: 800 },
  server: { port: 3048 },
  preview: { port: 3048 },
});
