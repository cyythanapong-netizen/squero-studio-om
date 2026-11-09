import assert from "node:assert/strict";
import { test } from "node:test";
import { closeDoc, neighbour, openDoc, visibleEntries, workspaceName, type Doc, type WorkspaceEntry } from "../src/shell/workspace.ts";

const entries: WorkspaceEntry[] = [
  { name: "Pkg", path: "/w/Pkg", kind: "package", depth: 0 },
  { name: "A", path: "/w/Pkg/A.mo", kind: "class", depth: 1 },
  { name: "Sub", path: "/w/Pkg/Sub", kind: "package", depth: 1 },
  { name: "B", path: "/w/Pkg/Sub/B.mo", kind: "class", depth: 2 },
  { name: "Quick", path: "/w/Quick.mo", kind: "class", depth: 0 },
];

test("a collapsed package hides exactly its subtree", () => {
  assert.deepEqual(visibleEntries(entries, new Set()).map((e) => e.name), ["Pkg", "A", "Sub", "B", "Quick"]);
  assert.deepEqual(visibleEntries(entries, new Set(["/w/Pkg"]))[0].name, "Pkg");
  assert.deepEqual(visibleEntries(entries, new Set(["/w/Pkg"])).map((e) => e.name), ["Pkg", "Quick"]);
  assert.deepEqual(visibleEntries(entries, new Set(["/w/Pkg/Sub"])).map((e) => e.name), ["Pkg", "A", "Sub", "Quick"]);
  assert.deepEqual(visibleEntries(entries, new Set(["/w/Pkg", "/w/Pkg/Sub"])).map((e) => e.name), ["Pkg", "Quick"]);
});

test("documents open once and keep their order", () => {
  const a: Doc = { file: "/w/A.mo", name: "A" };
  const b: Doc = { file: "/w/B.mo", name: "B" };
  assert.deepEqual(openDoc([], a), [a]);
  assert.deepEqual(openDoc([a], b), [a, b]);
  assert.deepEqual(openDoc([a, b], a), [a, b]);
  assert.deepEqual(openDoc([a], { ...a, name: "Renamed" }), [{ ...a, name: "Renamed" }]);
});

test("closing a document leaves a neighbour to show, never a hole", () => {
  const docs: Doc[] = [
    { file: "/w/A.mo", name: "A" },
    { file: "/w/B.mo", name: "B" },
    { file: "/w/C.mo", name: "C" },
  ];
  assert.equal(neighbour(docs, "/w/A.mo")?.name, "B");
  assert.equal(neighbour(docs, "/w/B.mo")?.name, "C");
  assert.equal(neighbour(docs, "/w/C.mo")?.name, "B");
  assert.equal(neighbour(docs, "/w/none.mo"), undefined);
  assert.deepEqual(closeDoc(docs, "/w/B.mo"), [docs[0], docs[2]]);
});

test("the rail names the folder it is in", () => {
  assert.equal(workspaceName({ root: "/home/me/chiller", file: "/home/me/chiller/A.mo", package: false, entries: [] }), "chiller");
  assert.equal(workspaceName({ root: "/", file: "/A.mo", package: false, entries: [] }), "/");
  assert.equal(workspaceName(null), "workspace");
});
