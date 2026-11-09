import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultWithin, fileFor, packageName, packageOptions, skeleton } from "../src/shell/newClass.ts";
import type { Workspace } from "../src/shell/workspace.ts";

const workspace: Workspace = {
  root: "/w",
  file: "/w/Pkg/Sub/B.mo",
  package: true,
  entries: [
    { name: "Pkg", path: "/w/Pkg", kind: "package", depth: 0 },
    { name: "A", path: "/w/Pkg/A.mo", kind: "class", depth: 1 },
    { name: "Sub", path: "/w/Pkg/Sub", kind: "package", depth: 1 },
    { name: "B", path: "/w/Pkg/Sub/B.mo", kind: "class", depth: 2 },
    { name: "Quick", path: "/w/Quick.mo", kind: "class", depth: 0 },
  ],
};

test("a package's qualified name is its path under the workspace root", () => {
  assert.equal(packageName("/w", "/w/Pkg"), "Pkg");
  assert.equal(packageName("/w", "/w/Pkg/Sub"), "Pkg.Sub");
  assert.equal(packageName("/w/", "/w/Pkg/Sub"), "Pkg.Sub");
});

test("the open model picks its own package, or the root", () => {
  assert.equal(defaultWithin({ name: "Pkg.Sub.B" }), "Pkg.Sub");
  assert.equal(defaultWithin({ name: "Quick" }), "");
});

test("package choices are the root then the tree", () => {
  assert.deepEqual(packageOptions(workspace).map((o) => o.value), ["", "Pkg", "Pkg.Sub"]);
  assert.deepEqual(packageOptions(null), [{ value: "", label: "workspace root" }]);
});

test("a new class lands beside its package, or at the root for a quick model", () => {
  assert.equal(fileFor(workspace, "Pkg.Sub", "Valve"), "/w/Pkg/Sub/Valve.mo");
  assert.equal(fileFor(workspace, "", "Valve"), "/w/Valve.mo");
  assert.equal(fileFor(workspace, "Nope", "Valve"), "/w/Valve.mo");
  assert.equal(fileFor(null, "", "Valve"), "/Valve.mo");
});

test("each kind gets its own skeleton, and a base class an extends", () => {
  const model = skeleton("model", "Pump", "Pkg.Sub");
  assert.match(model, /^within Pkg\.Sub;\n\nmodel Pump\n/);
  assert.match(model, /  Real x;\nequation\n/);
  assert.match(model, /end Pump;\n$/);
  assert.match(skeleton("block", "Gain", "", "Modelica.Blocks.Icons.Block"), /extends Modelica\.Blocks\.Icons\.Block;/);
  assert.match(skeleton("connector", "Port", ""), /flow Real i;/);
  assert.match(skeleton("record", "Medium", ""), /record Medium/);
  assert.match(skeleton("function", "F", ""), /algorithm\n  y := u;/);
});
