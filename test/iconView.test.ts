import assert from "node:assert/strict";
import { test } from "node:test";
import { primBounds, primFromDrag, resizePrim } from "../src/sheet/look.ts";

test("a drag draws the shape's box, snapped by the caller", () => {
  assert.deepEqual(primFromDrag("rect", [10, 10], [50, 40]), { t: "rect", x: 10, y: 10, w: 40, h: 30, corner: "0" });
  assert.deepEqual(primFromDrag("ellipse", [60, 70], [20, 30]), { t: "ellipse", x: 20, y: 30, w: 40, h: 40 });
  assert.deepEqual(primFromDrag("line", [5, 5], [95, 95]), { t: "line", p: [[5, 5], [95, 95]] });
  assert.equal(primFromDrag("poly", [10, 10], [30, 30]).t, "poly");
});

test("a click adds the default shape instead of a zero-size one", () => {
  assert.equal(primFromDrag("rect", [50, 50], [50, 50]).t, "rect");
  assert.deepEqual(primFromDrag("rect", [50, 50], [50, 50]), { t: "rect", x: 20, y: 25, w: 60, h: 50, corner: "0" });
  assert.equal(primFromDrag("text", [50, 50], [50, 50]).t, "text");
});

test("a corner handle resizes the box, never below five units", () => {
  const rect = { t: "rect" as const, x: 20, y: 20, w: 40, h: 40, corner: "0" as const };
  assert.deepEqual(resizePrim(rect, "se", [80, 80]), { t: "rect", x: 20, y: 20, w: 60, h: 60, corner: "0" });
  assert.deepEqual(resizePrim(rect, "nw", [10, 10]), { t: "rect", x: 10, y: 10, w: 50, h: 50, corner: "0" });
  const narrow = resizePrim(rect, "ne", [20, 0]);
  assert.equal(narrow.t === "rect" ? narrow.w : 0, 5);
});

test("the selection box wraps each primitive kind", () => {
  assert.deepEqual(primBounds({ t: "rect", x: 20, y: 20, w: 40, h: 40 }), { x: 18, y: 18, w: 44, h: 44 });
  const line = primBounds({ t: "line", p: [[10, 10], [50, 50]] });
  assert.deepEqual(line, { x: 7, y: 7, w: 46, h: 46 });
  assert.equal(primBounds({ t: "text", x: 50, y: 50, s: "x" }).w, 28);
});
