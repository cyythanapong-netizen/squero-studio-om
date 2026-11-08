import assert from "node:assert/strict";
import { test } from "node:test";
import { domainColor, domainOf } from "../src/canvas/domain.ts";

test("domain: a class takes its domain from its path; a user's class has none", () => {
  assert.equal(domainOf("Modelica.Blocks.Math.Gain"), "signal");
  assert.equal(domainOf("Modelica.Electrical.Analog.Basic.Resistor"), "electrical");
  assert.equal(domainOf("Modelica.Mechanics.Rotational.Components.Damper"), "rotational");
  assert.equal(domainOf("Modelica.Mechanics.Translational.Components.Mass"), "translational");
  assert.equal(domainOf("Modelica.Thermal.HeatTransfer.Components.HeatCapacitor"), "thermal");
  assert.equal(domainOf("MyPackage.Thing"), undefined);
  assert.equal(domainColor(undefined), undefined);
  assert.equal(domainColor("thermal"), "var(--dom-thermal)");
});
