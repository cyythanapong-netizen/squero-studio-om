import assert from "node:assert/strict";
import { test } from "node:test";
import { sampleAt, shapeMatrix, type Shape } from "../src/viewport3d/shapes.ts";

const box: Shape = {
  ident: "b", type: "box",
  T: [0, 1, 0, -1, 0, 0, 0, 0, 1], // frame turned +90° about z: its x is world y
  r: ["x", 0, 0], r_shape: [0.1, 0, 0],
  lengthDir: [2, 0, 0], widthDir: [1, 1, 0], // widthDir is made square to lengthDir
  length: 0.5, width: 0.2, height: 0.1, extra: 0, color: [255, 0, 0],
};

test("shapeMatrix maps the unit shape into world through T", () => {
  const m = shapeMatrix(box, (v) => (typeof v === "number" ? v : 3)).map((n) => Math.round(n * 1e9) / 1e9 + 0);
  assert.deepEqual(m.slice(0, 3), [0, 0.5, 0]); // length along world y
  assert.deepEqual(m.slice(4, 7), [-0.2, 0, 0]); // width along world -x
  assert.deepEqual(m.slice(8, 11), [0, 0, 0.1]);
  assert.deepEqual(m.slice(12), [3, 0.1, 0, 1]); // r + Tᵀ r_shape
});

test("sampleAt finds the sample at or before a time", () => {
  const t = [0, 0.5, 1, 1.5];
  assert.equal(sampleAt(t, 0), 0);
  assert.equal(sampleAt(t, 0.7), 1);
  assert.equal(sampleAt(t, 9), 3);
});
