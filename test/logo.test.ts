import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  STEM_M,
  SQUERO_LOGO_VIEWBOX,
  WATER_DOTS,
  WATER_Y,
  DOT_SIZE,
  RIPPLE_LIFT,
  BADGE_GEOMETRY,
  logoWidth,
} from "../src/shell/logo.ts";

test("squero logo: geometry strictly derives from module m = 13 (squero#42)", () => {
  const m = STEM_M;
  assert.equal(m, 13, "stem width m is 13px at font-size 100");

  // Water: 5 square dots of 1.5m, dot size = 19.5
  assert.equal(DOT_SIZE, 1.5 * m, "dot size is 1.5m");
  assert.equal(WATER_DOTS.length, 5, "5 water dots spread under 'squero'");

  // Clearance: lift = 0.67 * dot = 13.065; clearance gap = lift + 0.5m = 19.565
  // q descender = 16, so dot tops sit at 16 + 19.565 = 35.565
  const lift = RIPPLE_LIFT;
  assert.ok(Math.abs(lift - 0.67 * DOT_SIZE) < 1e-6, "ripple lift is 0.67 * dot");
  const gap = lift + 0.5 * m;
  const qDescender = 16;
  assert.ok(Math.abs(WATER_Y - (qDescender + gap)) < 1e-6, "water dots sit at descender(q) + lift + 0.5m");

  // Dot never touches q at top of ripple
  const crestY = WATER_Y - lift;
  assert.ok(crestY > qDescender, "at ripple crest, dot stays below q descender");
  assert.ok(Math.abs((crestY - qDescender) - 0.5 * m) < 1e-6, "clearance at crest is exactly 0.5m");

  // Badge (B3 Mono): square ink tile with radius 1m, height matching the wordmark block
  assert.equal(BADGE_GEOMETRY.radius, 1 * m, "badge radius is 1m");
  assert.equal(BADGE_GEOMETRY.size, SQUERO_LOGO_VIEWBOX.height, "badge is as tall as wordmark block");

  // Badge sits 3m after studio
  const sx = 358.2;
  const stuR = 286.9;
  assert.ok(Math.abs(BADGE_GEOMETRY.x - (sx + stuR + 3 * m)) < 1e-4, "badge is set 3m after studio");

  // Logo width scales with height
  assert.equal(logoWidth(20), (20 * 811.2) / 127.1, "width calculation preserves aspect ratio");
});

test("shell components: SqueroLogo and TopBar wire correctly", () => {
  const logoSource = fs.readFileSync(path.resolve(import.meta.dirname, "../src/shell/SqueroLogo.tsx"), "utf-8");
  assert.ok(logoSource.includes("squero-logo"), "SqueroLogo contains squero-logo class");
  assert.ok(logoSource.includes("logo-idle"), "SqueroLogo handles idle state");
  assert.ok(logoSource.includes("logo-live"), "SqueroLogo handles live running state");
  assert.ok(logoSource.includes("crispEdges"), "SqueroLogo sets crispEdges for water dots");

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

test("styles.css: .om-badge and .studio-word deleted; ripple keyframes and reduced-motion present", () => {
  const cssPath = path.resolve(import.meta.dirname, "../src/styles.css");
  const css = fs.readFileSync(cssPath, "utf-8");

  assert.ok(!css.includes(".om-badge"), ".om-badge has been removed from styles.css");
  assert.ok(!css.includes(".studio-word"), ".studio-word has been removed from styles.css");

  assert.ok(css.includes(".squero-logo"), ".squero-logo class present");
  assert.ok(css.includes("squero-ripple-idle"), "idle ripple animation keyframe defined");
  assert.ok(css.includes("squero-ripple-live"), "live ripple animation keyframe defined");
  assert.ok(css.includes("5s var(--ease) infinite"), "idle ripple runs every 5 s");
  assert.ok(css.includes("1.4s var(--ease) infinite"), "live ripple runs continuously on 1.4 s");
  assert.ok(css.includes("prefers-reduced-motion: reduce"), "prefers-reduced-motion media query present");
});
