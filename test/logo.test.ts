import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

test("shell components: SqueroLogo and TopBar wire correctly", () => {
  const topBarSource = fs.readFileSync(path.resolve(import.meta.dirname, "../src/shell/TopBar.tsx"), "utf-8");
  assert.ok(topBarSource.includes('aria-label="Squero Studio: OpenModelica"'), "Wordmark keeps accessibility aria-label");
  assert.ok(topBarSource.includes("<SqueroLogo"), "Wordmark mounts SqueroLogo");
  assert.ok(topBarSource.includes("running = false"), "TopBar accepts running state and passes to Wordmark");

  const appSource = fs.readFileSync(path.resolve(import.meta.dirname, "../src/App.tsx"), "utf-8");
  assert.ok(appSource.includes("running={running}"), "App passes running state to TopBar");
  assert.ok(appSource.includes("onRunningChange={setRunning}"), "App receives running state from Simulate");

  const simSource = fs.readFileSync(path.resolve(import.meta.dirname, "../src/simulate/Simulate.tsx"), "utf-8");
  assert.ok(simSource.includes("onRunningChange?.(phase.state === \"running\")"), "Simulate notifies running state change");
});

test("favicon: public/favicon.svg exists and index.html links to it", () => {
  const faviconPath = path.resolve(import.meta.dirname, "../public/favicon.svg");
  assert.ok(fs.existsSync(faviconPath), "public/favicon.svg exists");

  const svgContent = fs.readFileSync(faviconPath, "utf-8");
  assert.ok(svgContent.includes("<svg"), "favicon is an SVG file");
  assert.ok(svgContent.includes('rx="13"'), "favicon tile uses 1m radius (13px)");
  assert.ok(svgContent.includes("path"), "favicon contains vector path for OM code");

  const indexPath = path.resolve(import.meta.dirname, "../index.html");
  const indexContent = fs.readFileSync(indexPath, "utf-8");
  assert.ok(indexContent.includes('<link rel="icon" type="image/svg+xml" href="/favicon.svg"'), "index.html links to favicon.svg");
});

test("styles.css: .om-badge and .studio-word deleted; the logo styles come from @paperboat/shared", () => {
  const cssPath = path.resolve(import.meta.dirname, "../src/styles.css");
  const css = fs.readFileSync(cssPath, "utf-8");

  assert.ok(!css.includes(".om-badge"), ".om-badge has been removed from styles.css");
  assert.ok(!css.includes(".studio-word"), ".studio-word has been removed from styles.css");

  assert.ok(css.includes('@import "@paperboat/shared/squero.css"'), "logo, ripple and reduced-motion come from the shared squero.css");
});
