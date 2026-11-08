import assert from "node:assert/strict";
import { test } from "node:test";
import { byMenu, type Command } from "@paperboat/shared";
import { tokenize } from "../src/split/highlight.ts";
import { defaultExportFolder } from "../src/dock/dock.ts";

test("split: tokenize highlights Modelica (.mo) keywords, types, equations, annotations, numbers, and comments", () => {
  const moCode = `
// A simple resistor model
model TestResistor "A test component"
  import Modelica.Constants.pi;
  extends Modelica.Electrical.Analog.Interfaces.OnePort;
  parameter Real R(unit = "Ohm") = 100.0 "Resistance";
  final parameter Boolean active = true;
  /* Multi-line
     equation block */
  initial equation
    v = 0.0;
  equation
    i = v / R;
    annotation(Icon(coordinateSystem(extent={{-100,-100},{100,100}})));
end TestResistor;
`.trim();

  const lines = tokenize(moCode, "mo");
  assert.ok(lines.length > 5, "produced tokenized lines");

  const allTokens = lines.flat();
  const keywords = allTokens.filter((t) => t.type === "keyword").map((t) => t.text);
  const types = allTokens.filter((t) => t.type === "type").map((t) => t.text);
  const numbers = allTokens.filter((t) => t.type === "number").map((t) => t.text);
  const booleans = allTokens.filter((t) => t.type === "boolean").map((t) => t.text);
  const comments = allTokens.filter((t) => t.type === "comment").map((t) => t.text);
  const strings = allTokens.filter((t) => t.type === "string").map((t) => t.text);
  const annotations = allTokens.filter((t) => t.type === "annotation").map((t) => t.text);

  assert.ok(keywords.includes("model"), "model keyword found");
  assert.ok(keywords.includes("import"), "import keyword found");
  assert.ok(keywords.includes("extends"), "extends keyword found");
  assert.ok(keywords.includes("parameter"), "parameter keyword found");
  assert.ok(keywords.includes("final"), "final keyword found");
  assert.ok(keywords.includes("initial equation"), "composite initial equation keyword found");
  assert.ok(keywords.includes("equation"), "equation keyword found");
  assert.ok(keywords.includes("end"), "end keyword found");

  assert.ok(types.includes("Real"), "Real type found");
  assert.ok(types.includes("Boolean"), "Boolean type found");

  assert.ok(numbers.includes("100.0") || numbers.includes("100"), "number literal found");
  assert.ok(numbers.includes("0.0") || numbers.includes("0"), "zero float found");

  assert.ok(booleans.includes("true"), "boolean true found");
  assert.ok(comments.some((c) => c.includes("A simple resistor model")), "line comment found");
  assert.ok(comments.some((c) => c.includes("Multi-line")), "block comment found");
  assert.ok(strings.includes('"A test component"'), "string literal found");
  assert.ok(annotations.includes("annotation"), "annotation token found");
});

test("split: tokenize highlights C++ backend source panels", () => {
  const cppCode = `
#include <iostream>
#include <vector>

namespace squero {
class MyModel : public CausalODE {
public:
  double evaluate(const double* x, double t) override {
    // state derivative
    return -x[0] * 1.5e-3;
  }
};
}
`.trim();

  const lines = tokenize(cppCode, "cpp");
  assert.ok(lines.length > 5, "produced tokenized C++ lines");

  const allTokens = lines.flat();
  const keywords = allTokens.filter((t) => t.type === "keyword").map((t) => t.text);
  const types = allTokens.filter((t) => t.type === "type").map((t) => t.text);
  const preproc = allTokens.filter((t) => t.type === "preprocessor").map((t) => t.text);
  const comments = allTokens.filter((t) => t.type === "comment").map((t) => t.text);
  const numbers = allTokens.filter((t) => t.type === "number").map((t) => t.text);

  assert.ok(keywords.includes("namespace"), "namespace keyword found");
  assert.ok(keywords.includes("class"), "class keyword found");
  assert.ok(keywords.includes("public"), "public keyword found");
  assert.ok(keywords.includes("const"), "const keyword found");
  assert.ok(keywords.includes("override"), "override keyword found");
  assert.ok(keywords.includes("return"), "return keyword found");

  assert.ok(types.includes("double"), "double type found");
  assert.ok(preproc.some((p) => p.includes("#include")), "preprocessor #include found");
  assert.ok(comments.some((c) => c.includes("state derivative")), "comment found");
  assert.ok(numbers.includes("1.5e-3"), "scientific notation number found");
});

test("menu: File menu is the first menu and provides core model lifecycle commands", () => {
  const commands: Command[] = [
    { id: "file.new", label: "New Model", menu: "file", group: "model", shortcut: "Ctrl+N", chord: { key: "n", ctrl: true }, run: () => {} },
    { id: "file.open", label: "Open / Import .mo…", menu: "file", group: "model", shortcut: "Ctrl+O", chord: { key: "o", ctrl: true }, run: () => {} },
    { id: "file.save", label: "Save", menu: "file", group: "save", shortcut: "Ctrl+S", chord: { key: "s", ctrl: true }, run: () => {} },
    { id: "file.save-as", label: "Save As…", menu: "file", group: "save", shortcut: "Ctrl+Shift+S", chord: { key: "s", ctrl: true, shift: true }, run: () => {} },
    { id: "file.load-library", label: "Load Modelica Library…", menu: "file", group: "library", run: () => {} },
    { id: "file.export", label: "Export Paperboat Backend", menu: "file", group: "export", shortcut: "Ctrl+E", chord: { key: "e", ctrl: true }, run: () => {} },
    { id: "undo", label: "Undo", menu: "edit", group: "history", shortcut: "Ctrl+Z", run: () => {} },
    { id: "redo", label: "Redo", menu: "edit", group: "history", shortcut: "Ctrl+Shift+Z", run: () => {} },
    { id: "side", label: "Source and Simulate", menu: "view", group: "panes", run: () => {} },
  ];

  const menus = byMenu(commands);
  assert.equal(menus[0].id, "file", "File menu is the first menu");
  assert.equal(menus[0].label, "File");

  const fileItemIds = menus[0].items.map((i) => i.id);
  assert.ok(fileItemIds.includes("file.new"), "New Model command registered");
  assert.ok(fileItemIds.includes("file.open"), "Open / Import command registered");
  assert.ok(fileItemIds.includes("file.save"), "Save command registered");
  assert.ok(fileItemIds.includes("file.save-as"), "Save As command registered");
  assert.ok(fileItemIds.includes("file.load-library"), "Load Modelica Library command registered");
  assert.ok(fileItemIds.includes("file.export"), "Export Paperboat Backend command registered");

  const saveCmd = menus[0].items.find((i) => i.id === "file.save")!;
  assert.equal(saveCmd.shortcut, "Ctrl+S");
  const openCmd = menus[0].items.find((i) => i.id === "file.open")!;
  assert.equal(openCmd.shortcut, "Ctrl+O");
  const exportCmd = menus[0].items.find((i) => i.id === "file.export")!;
  assert.equal(exportCmd.shortcut, "Ctrl+E");
});

test("export: defaultExportFolder formats model name correctly", () => {
  assert.equal(defaultExportFolder("DCMotor"), "dc-motor-cpp");
  assert.equal(defaultExportFolder("Modelica.Electrical.Analog.Basic.Resistor"), "resistor-cpp");
  assert.equal(defaultExportFolder("CartPole"), "cart-pole-cpp");
});
