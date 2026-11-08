// The class library behind the component browser and `/` quick-add: Modelica's packages, read
// lazily from omc one package at a time (`getClassNames(P)`), and one flat list of every part for searching.

import type { OmcCalls } from "../omc/omc.ts";
import { atom, list, parseValue } from "../omc/parse.ts";

export type Kind = "package" | "part";
export type Entry = { name: string; full: string; kind: Kind; comment: string };

export type ComponentPortSummary = {
  id: string;
  side?: string;
  class?: string;
  kind?: "input" | "output" | "acausal";
};

export type ComponentCardItem = {
  name: string;        // e.g. "Resistor"
  full: string;        // e.g. "Modelica.Electrical.Analog.Basic.Resistor"
  category: string;    // e.g. "Electrical"
  subpackage: string;  // e.g. "Electrical.Analog.Basic"
  comment: string;     // Docstring / description
  ports?: ComponentPortSummary[];
};

/** Built-in curated catalog of common MSL components with descriptions and ports. */
export const KNOWN_METADATA: Record<string, { comment: string; ports: ComponentPortSummary[] }> = {
  "Modelica.Electrical.Analog.Basic.Resistor": {
    comment: "Ideal electrical resistor",
    ports: [
      { id: "p", class: "PositivePin", kind: "acausal" },
      { id: "n", class: "NegativePin", kind: "acausal" },
    ],
  },
  "Modelica.Electrical.Analog.Basic.Capacitor": {
    comment: "Ideal electrical capacitor",
    ports: [
      { id: "p", class: "PositivePin", kind: "acausal" },
      { id: "n", class: "NegativePin", kind: "acausal" },
    ],
  },
  "Modelica.Electrical.Analog.Basic.Inductor": {
    comment: "Ideal electrical inductor",
    ports: [
      { id: "p", class: "PositivePin", kind: "acausal" },
      { id: "n", class: "NegativePin", kind: "acausal" },
    ],
  },
  "Modelica.Electrical.Analog.Basic.Ground": {
    comment: "Ground node (potential = 0 V)",
    ports: [{ id: "p", class: "Pin", kind: "acausal" }],
  },
  "Modelica.Electrical.Analog.Basic.VariableResistor": {
    comment: "Electrical resistor with variable resistance input",
    ports: [
      { id: "p", class: "PositivePin", kind: "acausal" },
      { id: "n", class: "NegativePin", kind: "acausal" },
      { id: "R", class: "RealInput", kind: "input" },
    ],
  },
  "Modelica.Electrical.Analog.Sources.ConstantVoltage": {
    comment: "Source for constant voltage",
    ports: [
      { id: "p", class: "PositivePin", kind: "acausal" },
      { id: "n", class: "NegativePin", kind: "acausal" },
    ],
  },
  "Modelica.Electrical.Analog.Sources.SineVoltage": {
    comment: "Sine voltage source",
    ports: [
      { id: "p", class: "PositivePin", kind: "acausal" },
      { id: "n", class: "NegativePin", kind: "acausal" },
    ],
  },
  "Modelica.Electrical.Analog.Sources.StepVoltage": {
    comment: "Step voltage source",
    ports: [
      { id: "p", class: "PositivePin", kind: "acausal" },
      { id: "n", class: "NegativePin", kind: "acausal" },
    ],
  },
  "Modelica.Mechanics.Rotational.Components.Inertia": {
    comment: "1D-rotational component with inertia",
    ports: [
      { id: "flange_a", class: "Flange_a", kind: "acausal" },
      { id: "flange_b", class: "Flange_b", kind: "acausal" },
    ],
  },
  "Modelica.Mechanics.Rotational.Components.Damper": {
    comment: "Ideal rotational damper",
    ports: [
      { id: "flange_a", class: "Flange_a", kind: "acausal" },
      { id: "flange_b", class: "Flange_b", kind: "acausal" },
    ],
  },
  "Modelica.Mechanics.Rotational.Components.Spring": {
    comment: "Linear 1D rotational spring",
    ports: [
      { id: "flange_a", class: "Flange_a", kind: "acausal" },
      { id: "flange_b", class: "Flange_b", kind: "acausal" },
    ],
  },
  "Modelica.Mechanics.Rotational.Sources.Torque": {
    comment: "Input torque driving a flange",
    ports: [
      { id: "flange", class: "Flange_b", kind: "acausal" },
      { id: "tau", class: "RealInput", kind: "input" },
    ],
  },
  "Modelica.Mechanics.Translational.Components.Mass": {
    comment: "Sliding mass with inertia",
    ports: [
      { id: "flange_a", class: "Flange_a", kind: "acausal" },
      { id: "flange_b", class: "Flange_b", kind: "acausal" },
    ],
  },
  "Modelica.Thermal.HeatTransfer.Components.HeatCapacitor": {
    comment: "Lumped thermal capacitor",
    ports: [{ id: "port", class: "HeatPort_a", kind: "acausal" }],
  },
  "Modelica.Thermal.HeatTransfer.Components.ThermalConductor": {
    comment: "Lumped thermal conductor",
    ports: [
      { id: "port_a", class: "HeatPort_a", kind: "acausal" },
      { id: "port_b", class: "HeatPort_b", kind: "acausal" },
    ],
  },
  "Modelica.Fluid.Pipes.StaticPipe": {
    comment: "Basic pipe component for single-phase incompressible fluid",
    ports: [
      { id: "port_a", class: "FluidPort_a", kind: "acausal" },
      { id: "port_b", class: "FluidPort_b", kind: "acausal" },
    ],
  },
  "Modelica.Fluid.Valves.ValveLinear": {
    comment: "Valve with linear pressure drop characteristic",
    ports: [
      { id: "port_a", class: "FluidPort_a", kind: "acausal" },
      { id: "port_b", class: "FluidPort_b", kind: "acausal" },
      { id: "opening", class: "RealInput", kind: "input" },
    ],
  },
  "Modelica.Fluid.Sources.MassFlowSource_T": {
    comment: "Ideal mass flow source with fixed temperature",
    ports: [{ id: "ports", class: "FluidPort_b", kind: "acausal" }],
  },
  "Modelica.Blocks.Continuous.Integrator": {
    comment: "Continuous-time integrator",
    ports: [
      { id: "u", class: "RealInput", kind: "input" },
      { id: "y", class: "RealOutput", kind: "output" },
    ],
  },
  "Modelica.Blocks.Continuous.Derivative": {
    comment: "Continuous-time derivative block",
    ports: [
      { id: "u", class: "RealInput", kind: "input" },
      { id: "y", class: "RealOutput", kind: "output" },
    ],
  },
  "Modelica.Blocks.Continuous.FirstOrder": {
    comment: "First-order transfer function filter (PT1)",
    ports: [
      { id: "u", class: "RealInput", kind: "input" },
      { id: "y", class: "RealOutput", kind: "output" },
    ],
  },
  "Modelica.Blocks.Math.Add": {
    comment: "Output the sum of two inputs",
    ports: [
      { id: "u1", class: "RealInput", kind: "input" },
      { id: "u2", class: "RealInput", kind: "input" },
      { id: "y", class: "RealOutput", kind: "output" },
    ],
  },
  "Modelica.Blocks.Math.Feedback": {
    comment: "Output difference between command and feedback",
    ports: [
      { id: "u1", class: "RealInput", kind: "input" },
      { id: "u2", class: "RealInput", kind: "input" },
      { id: "y", class: "RealOutput", kind: "output" },
    ],
  },
  "Modelica.Blocks.Math.Gain": {
    comment: "Output product of input with gain factor",
    ports: [
      { id: "u", class: "RealInput", kind: "input" },
      { id: "y", class: "RealOutput", kind: "output" },
    ],
  },
  "Modelica.Blocks.Math.Product": {
    comment: "Output product of two inputs",
    ports: [
      { id: "u1", class: "RealInput", kind: "input" },
      { id: "u2", class: "RealInput", kind: "input" },
      { id: "y", class: "RealOutput", kind: "output" },
    ],
  },
  "Modelica.Blocks.Sources.Constant": {
    comment: "Generate constant real signal",
    ports: [{ id: "y", class: "RealOutput", kind: "output" }],
  },
  "Modelica.Blocks.Sources.Step": {
    comment: "Generate step real signal",
    ports: [{ id: "y", class: "RealOutput", kind: "output" }],
  },
  "Modelica.Blocks.Sources.Sine": {
    comment: "Generate sine real signal",
    ports: [{ id: "y", class: "RealOutput", kind: "output" }],
  },
  "Modelica.Blocks.Sources.Ramp": {
    comment: "Generate ramp real signal",
    ports: [{ id: "y", class: "RealOutput", kind: "output" }],
  },
  "Modelica.Blocks.Interfaces.RealInput": {
    comment: "Causal Real input connector",
    ports: [{ id: "y", class: "RealOutput", kind: "output" }],
  },
  "Modelica.Blocks.Interfaces.RealOutput": {
    comment: "Causal Real output connector",
    ports: [{ id: "u", class: "RealInput", kind: "input" }],
  },
};

export const DEFAULT_MSL_CLASSES: string[] = Object.keys(KNOWN_METADATA);

/** Resolves the primary category for a Modelica class path. */
export function domainOf(full: string): string {
  const parts = full.split(".");
  if (parts.length <= 1) return parts[0] || "Custom";
  if (parts[0] === "Modelica") {
    const d = parts[1];
    if (d === "Blocks" && parts[2] === "Sources") return "Sources";
    if (d === "Blocks" && parts[2] === "Math") return "Math";
    if (parts.includes("Sources")) return "Sources";
    return d;
  }
  return parts[0];
}

/** Resolves all matching categories for a Modelica class path. */
export function categoriesOf(full: string): string[] {
  const parts = full.split(".");
  const cats = new Set<string>();
  if (parts.includes("Electrical")) cats.add("Electrical");
  if (parts.includes("Mechanics")) cats.add("Mechanics");
  if (parts.includes("Thermal")) cats.add("Thermal");
  if (parts.includes("Blocks")) cats.add("Blocks");
  if (parts.includes("Math")) cats.add("Math");
  if (parts.includes("Sources")) cats.add("Sources");
  if (parts.includes("Fluid")) cats.add("Fluid");
  if (cats.size === 0) {
    const d = domainOf(full);
    cats.add(d);
  }
  return Array.from(cats);
}

/** Constructs a ComponentCardItem from a full class name and optional comment. */
export function makeComponentItem(full: string, comment = ""): ComponentCardItem {
  const parts = full.split(".");
  const name = parts[parts.length - 1];
  const category = domainOf(full);
  const subpackage = parts.length > 2 ? parts.slice(1, -1).join(".") : category;
  const meta = KNOWN_METADATA[full];
  return {
    name,
    full,
    category,
    subpackage,
    comment: comment || meta?.comment || "",
    ports: meta?.ports ? [...meta.ports] : undefined,
  };
}

/**
 * Instant fuzzy scoring for component items matching Paperboat's Browser.tsx.
 * Matches short names, full paths, categories, descriptions, and port IDs.
 */
export function searchComponents(items: ComponentCardItem[], query: string, category = "All"): ComponentCardItem[] {
  const q = query.trim().toLowerCase();
  const byCategory = (it: ComponentCardItem) =>
    category === "All" ||
    it.category.toLowerCase() === category.toLowerCase() ||
    categoriesOf(it.full).some((c) => c.toLowerCase() === category.toLowerCase());

  const filtered = items.filter(byCategory);
  if (!q) return filtered;

  const score = (it: ComponentCardItem): number => {
    const name = it.name.toLowerCase();
    const full = it.full.toLowerCase();
    if (name === q) return 0;
    if (name.startsWith(q)) return 1;
    if (name.split(/[\s\-_]+/).some((w) => w.startsWith(q))) return 2;
    if (name.includes(q)) return 3;
    if (full.includes(q)) return 4;
    const rest = [
      it.comment,
      it.category,
      it.subpackage,
      ...(it.ports?.map((p) => p.id) ?? []),
      ...(it.ports?.map((p) => p.class ?? "") ?? []),
    ].join(" ").toLowerCase();
    return rest.includes(q) ? 5 : 9;
  };

  return filtered
    .map((it) => [score(it), it] as const)
    .filter(([s]) => s < 9)
    .sort((a, b) => a[0] - b[0] || a[1].name.length - b[1].name.length || a[1].full.localeCompare(b[1].full))
    .map(([, it]) => it);
}

/** How many parts sit under each package of `names`, at every depth: `A.B.C` counts for A and A.B. */
export function packageCounts(names: string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const n of names) {
    for (let i = n.indexOf("."); i > 0; i = n.indexOf(".", i + 1)) out.set(n.slice(0, i), (out.get(n.slice(0, i)) ?? 0) + 1);
  }
  return out;
}

/** Packages that hold documentation and demos, not parts. */
const SKIP = new Set(["UsersGuide", "Examples", "Icons", "Internal", "Types", "Interfaces", "Utilities"]);

export const isPartPath = (full: string) => !full.split(".").some((s, i) => i > 0 && SKIP.has(s));

/** The children of package `pkg`: packages to open, and models, blocks and connectors to place. */
const seen = new Map<string, Promise<Entry[]>>();

export function children(omc: OmcCalls, pkg: string): Promise<Entry[]> {
  let got = seen.get(pkg);
  if (!got) {
    got = read(omc, pkg);
    seen.set(pkg, got);
    got.catch(() => seen.delete(pkg));
  }
  return got;
}

async function read(omc: OmcCalls, pkg: string): Promise<Entry[]> {
  const names = list(parseValue(await omc.call(`getClassNames(${pkg})`))).map(atom);
  const out = await Promise.all(
    names
      .filter((n) => n && !(SKIP.has(n) && pkg === "Modelica") && n !== "UsersGuide" && n !== "Examples")
      .map(async (name): Promise<Entry | null> => {
        const full = `${pkg}.${name}`;
        const restriction = atom(parseValue(await omc.call(`getClassRestriction(${full})`).catch(() => '""')));
        if (restriction === "package") return { name, full, kind: "package", comment: "" };
        if (!["model", "block", "connector", "class"].includes(restriction)) return null;
        if (atom(parseValue(await omc.call(`isPartial(${full})`).catch(() => "false"))) === "true") return null;
        const comment = atom(parseValue(await omc.call(`getClassComment(${full})`).catch(() => '""')));
        return { name, full, kind: "part", comment };
      }),
  );
  return out.filter((e): e is Entry => e !== null);
}

/**
 * Every part under `pkg`, qualified, for searching. A name that other names are inside of is a
 * package, so it is left out without asking omc about each of thousands; so are demos and guides.
 */
export async function flat(omc: OmcCalls, pkg: string): Promise<string[]> {
  const all = list(parseValue(await omc.call(`getClassNames(${pkg}, recursive=true)`))).map(atom);
  const packages = new Set(all.flatMap((n) => n.split(".").slice(1).map((_, i, parts) => n.split(".").slice(0, parts.length - i).join("."))));
  return all.filter((n) => n !== pkg && !packages.has(n) && isPartPath(n) && /^[A-Z]/.test(n.slice(n.lastIndexOf(".") + 1)));
}

/** Matches of `query` among `names` by short name first, then by path: "res" finds Resistor. */
export function search(names: string[], query: string, limit = 40): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const short = (n: string) => n.slice(n.lastIndexOf(".") + 1).toLowerCase();
  const rank = (n: string) => (short(n) === q ? 0 : short(n).startsWith(q) ? 1 : short(n).includes(q) ? 2 : n.toLowerCase().includes(q) ? 3 : 4);
  return names
    .map((n) => [rank(n), n] as const)
    .filter(([r]) => r < 4)
    .sort((a, b) => a[0] - b[0] || a[1].length - b[1].length)
    .slice(0, limit)
    .map(([, n]) => n);
}
