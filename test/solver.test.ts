import assert from "node:assert/strict";
import { test } from "node:test";
import { fmuSolver, summary } from "../src/simulate/solver.ts";

test("an export keeps the Simulate solver as far as an FMU can", () => {
  assert.equal(fmuSolver({ method: "euler" }), "euler");
  assert.equal(fmuSolver({ method: "dassl" }), "cvode");
  assert.equal(summary({ method: "cvode", tolerance: 1e-8 }), "CVODE · 1e-8");
  assert.equal(summary({ method: "dassl" }), "DASSL · 1e-6");
  assert.equal(summary({ method: "rungekutta" }), "Runge–Kutta"); // fixed step: no tolerance
});
