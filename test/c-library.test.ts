import assert from "node:assert/strict";
import { test } from "node:test";
import {
  categoriesOf,
  domainOf,
  makeComponentItem,
  searchComponents,
  STANDARD_CATEGORIES,
  DEFAULT_MSL_CLASSES,
  type ComponentCardItem,
} from "../src/library/classes.ts";

test("library: domainOf maps Modelica class paths to domain categories", () => {
  assert.ok(STANDARD_CATEGORIES.includes("Electrical"));
  assert.ok(STANDARD_CATEGORIES.includes("Mechanics"));
  assert.ok(STANDARD_CATEGORIES.includes("Fluid"));
  assert.equal(domainOf("Modelica.Electrical.Analog.Basic.Resistor"), "Electrical");
  assert.equal(domainOf("Modelica.Mechanics.Rotational.Components.Inertia"), "Mechanics");
  assert.equal(domainOf("Modelica.Thermal.HeatTransfer.Components.HeatCapacitor"), "Thermal");
  assert.equal(domainOf("Modelica.Fluid.Pipes.StaticPipe"), "Fluid");
  assert.equal(domainOf("Modelica.Blocks.Continuous.Integrator"), "Blocks");
  assert.equal(domainOf("Modelica.Blocks.Math.Add"), "Math");
  assert.equal(domainOf("Modelica.Blocks.Sources.Sine"), "Sources");
  assert.equal(domainOf("Modelica.Electrical.Analog.Sources.ConstantVoltage"), "Sources");
  assert.equal(domainOf("CustomPackage.MyModel"), "CustomPackage");
});

test("library: categoriesOf includes secondary categories and multi-domain tags", () => {
  const resistorCats = categoriesOf("Modelica.Electrical.Analog.Basic.Resistor");
  assert.ok(resistorCats.includes("Electrical"));

  const sineCats = categoriesOf("Modelica.Blocks.Sources.Sine");
  assert.ok(sineCats.includes("Sources"));
  assert.ok(sineCats.includes("Blocks"));

  const mathCats = categoriesOf("Modelica.Blocks.Math.Add");
  assert.ok(mathCats.includes("Math"));
  assert.ok(mathCats.includes("Blocks"));
});

test("library: makeComponentItem populates rich metadata, ports, and docstring", () => {
  const item = makeComponentItem("Modelica.Electrical.Analog.Basic.Resistor");
  assert.equal(item.name, "Resistor");
  assert.equal(item.category, "Electrical");
  assert.equal(item.subpackage, "Electrical.Analog.Basic");
  assert.ok(item.comment.includes("resistor"));
  assert.ok(item.ports && item.ports.length >= 2);
  assert.deepEqual(item.ports?.map((p) => p.id), ["p", "n"]);

  const inertia = makeComponentItem("Modelica.Mechanics.Rotational.Components.Inertia");
  assert.equal(inertia.name, "Inertia");
  assert.equal(inertia.category, "Mechanics");
  assert.ok(inertia.ports && inertia.ports.some((p) => p.id === "flange_a"));
});

test("library: searchComponents ranks exact short name first, then prefix, words, and full path", () => {
  const items: ComponentCardItem[] = [
    makeComponentItem("Modelica.Electrical.Analog.Basic.Resistor"),
    makeComponentItem("Modelica.Electrical.Analog.Basic.VariableResistor"),
    makeComponentItem("Modelica.Electrical.Analog.Basic.Ground"),
    makeComponentItem("Modelica.Mechanics.Rotational.Components.Inertia"),
    makeComponentItem("Modelica.Blocks.Math.Gain"),
    makeComponentItem("Modelica.Blocks.Sources.Sine"),
  ];

  // Exact match
  const resHits = searchComponents(items, "Resistor");
  assert.equal(resHits[0].name, "Resistor");
  assert.equal(resHits[1].name, "VariableResistor");

  // Prefix match
  const gainHits = searchComponents(items, "gai");
  assert.equal(gainHits.length, 1);
  assert.equal(gainHits[0].name, "Gain");

  // Domain search
  const mechHits = searchComponents(items, "Mechanics");
  assert.ok(mechHits.some((h) => h.name === "Inertia"));

  // Docstring / comment search
  const groundHits = searchComponents(items, "potential");
  assert.ok(groundHits.some((h) => h.name === "Ground"));

  // Port search
  const flangeHits = searchComponents(items, "flange_a");
  assert.ok(flangeHits.some((h) => h.name === "Inertia"));
});

test("library: searchComponents respects category filter", () => {
  const items: ComponentCardItem[] = DEFAULT_MSL_CLASSES.map((cls) => makeComponentItem(cls));

  const electricalOnly = searchComponents(items, "", "Electrical");
  assert.ok(electricalOnly.length > 0);
  for (const it of electricalOnly) {
    const cats = categoriesOf(it.full);
    assert.ok(cats.includes("Electrical") || it.category === "Electrical");
  }

  const mechanicsOnly = searchComponents(items, "", "Mechanics");
  assert.ok(mechanicsOnly.length > 0);
  assert.ok(mechanicsOnly.some((it) => it.name === "Inertia"));
  assert.ok(!mechanicsOnly.some((it) => it.name === "Resistor"));

  // Combined search within category
  const filtered = searchComponents(items, "source", "Electrical");
  assert.ok(filtered.some((it) => it.name === "ConstantVoltage"));
  assert.ok(!filtered.some((it) => it.category === "Mechanics"));

  const fluidOnly = searchComponents(items, "", "Fluid");
  assert.ok(fluidOnly.length > 0);
  assert.ok(fluidOnly.some((it) => it.name === "StaticPipe"));
  assert.ok(fluidOnly.some((it) => it.name === "ValveLinear"));
});
