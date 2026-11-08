import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

test("menu styling: styles.css imports tokens.css and plates.css from @paperboat/shared", () => {
  const cssPath = path.resolve(import.meta.dirname, "../src/styles.css");
  const css = fs.readFileSync(cssPath, "utf-8");

  assert.match(
    css,
    /@import\s+["']@paperboat\/shared\/tokens\.css["'];/,
    "styles.css must import tokens.css from @paperboat/shared",
  );
  assert.match(
    css,
    /@import\s+["']@paperboat\/shared\/plates\.css["'];/,
    "styles.css must import plates.css from @paperboat/shared",
  );
});

test("vite config: server.fs.allow allows sibling @paperboat/shared package", () => {
  const configPath = path.resolve(import.meta.dirname, "../vite.config.ts");
  const config = fs.readFileSync(configPath, "utf-8");

  assert.ok(
    config.includes("allow:") && config.includes('".."'),
    "vite.config.ts must allow parent directory so sibling package assets resolve in dev server",
  );
});

test("menu styling: plates.css defines .menu-title with var(--size-sm) matching Paperboat", () => {
  const platesPath = path.resolve(import.meta.dirname, "../../paperboat-shared/src/plates.css");
  const plates = fs.readFileSync(platesPath, "utf-8");

  assert.match(
    plates,
    /\.menu-title\s*\{[^}]*font:\s*400\s+var\(--size-sm\)\s+var\(--font-sans\)/,
    ".menu-title in plates.css must specify font: 400 var(--size-sm) var(--font-sans)",
  );
});
