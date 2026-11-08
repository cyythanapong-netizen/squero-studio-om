// What each StudioApi action sends to omc, as plain data: the expressions, or the words why not.
// The hook in index.tsx only runs them; a test can read them here.

import type { IconDef } from "@paperboat/shared";
import type { Connection, StudioModel } from "../model/types.ts";
import * as x from "./exprs.ts";
import { endOf, hasWire, split, wireError } from "./wires.ts";

/** "R1.R" sets a part's modifier; "J" a top-level parameter's default, made (public) first when it isn't there. */
export function setParamExprs(model: StudioModel, path: string, value: string): string[] {
  if (path.includes(".")) return [x.setModifier(model.name, path, value)];
  return model.params.some((p) => p.id === path) ? [x.setParameter(model.name, path, value)] : addVariableExprs(model, path, value, false);
}

/** `parameter Real name = value`, in the protected section when private. */
export function addVariableExprs(model: StudioModel, name: string, value: string, isPrivate: boolean, cls = "Real"): string[] {
  if (!/^[A-Za-z_]\w*$/.test(name)) throw new Error(`${name || "an empty name"} isn't a Modelica name`);
  if (model.params.some((p) => p.id === name) || model.components.some((c) => c.name === name)) throw new Error(`${name} is taken`);
  return [x.addPlain(model.name, cls, name), x.setVariable(model.name, name, isPrivate), x.setParameter(model.name, name, value)];
}

const reads = (name: string) => new RegExp(`(?<![\\w.])${name}(?!\\w)`, "g");

/** Where a top-level parameter is read: "R1.R" for a modifier, "k" for another parameter's binding. */
export function usesOf(model: StudioModel, name: string): string[] {
  const re = reads(name);
  return [
    ...model.components.flatMap((c) => Object.entries(c.params).filter(([, v]) => v.match(re)).map(([k]) => `${c.name}.${k}`)),
    ...model.params.filter((p) => p.id !== name && typeof p.default === "string" && p.default.match(re)).map((p) => p.id),
  ];
}

/** omc's renameComponent crashes, so: the new one, every reader rewritten, the old one gone. */
export function renameVariableExprs(model: StudioModel, from: string, to: string): string[] {
  const p = model.params.find((q) => q.id === from);
  if (!p) throw new Error(`no variable ${from}`);
  if (from === to) return [];
  const re = reads(from);
  const out = addVariableExprs(model, to, String(p.default), !!p.private, p.modelica ?? "Real");
  for (const c of model.components)
    for (const [k, v] of Object.entries(c.params)) if (v.match(re)) out.push(x.setModifier(model.name, `${c.name}.${k}`, v.replace(re, to)));
  for (const q of model.params)
    if (q.id !== from && typeof q.default === "string" && q.default.match(re)) out.push(x.setParameter(model.name, q.id, q.default.replace(re, to)));
  return [...out, x.deleteComponent(model.name, from)];
}

export function removeVariableExprs(model: StudioModel, name: string): string[] {
  const uses = usesOf(model, name);
  if (uses.length) throw new Error(`${uses.join(", ")} ${uses.length > 1 ? "read" : "reads"} ${name}: unbind ${uses.length > 1 ? "them" : "it"} first`);
  return [x.deleteComponent(model.name, name)];
}

/** One wire a-b: refused in words (the §4 rules, a wire that is already there), or the one expression. */
export function connectExprs(model: StudioModel, a: string, b: string): { error: string } | { exprs: string[] } {
  const why = wireError(model, a, b);
  if (why) return { error: why };
  if (hasWire(model, a, b)) return { error: "those two are already wired" };
  return { exprs: [x.addConnection(model.name, a, b)] };
}

/** `+ Input` / `+ Probe`: a RealInput or RealOutput on the model, wired to the port `target`. */
export function entryExprs(model: StudioModel, kind: "input" | "output", target: string): string[] {
  const end = target.includes(".") ? endOf(model, target) : null;
  if (!end) throw new Error("a probe or input needs a port to attach to; variables need an annotation in the .mo for now");
  // a RealOutput on a pin (connect(R1.n, y)) is a type error omc refuses: simulate and export both fail
  if (end.kind !== kind) throw new Error(`${target} is not a signal ${kind}; put a sensor on it and ${kind === "input" ? "drive" : "probe"} the sensor`);
  const taken = model.components.map((c) => c.name);
  // named for the port it joins (V1.v -> v, S2.w -> w), else u/y; a taken name gets a number
  const port = split(target).port;
  const base = /^[a-z]\w*$/i.test(port) && !taken.includes(port) ? port : kind === "input" ? "u" : "y";
  const name = !taken.includes(base) ? base : [...Array(99).keys()].map((i) => `${base}${i + 1}`).find((n) => !taken.includes(n))!;
  const part = model.components.find((c) => c.name === split(target).part);
  const at = { x: x.snap((part?.placement.x ?? 0) + (kind === "input" ? -200 : 200)), y: part?.placement.y ?? 0, rotation: 0 as const };
  const cls = kind === "input" ? "Modelica.Blocks.Interfaces.RealInput" : "Modelica.Blocks.Interfaces.RealOutput";
  return [x.addComponent(model.name, cls, name, at), kind === "input" ? x.addConnection(model.name, name, target) : x.addConnection(model.name, target, name)];
}

/** The Look tab's port placement, written back as each entry's iconTransformation (the inverse of the importer's quantise_ports). */
export function iconPortExprs(model: StudioModel, icon: IconDef): string[] {
  const halfW = 100 * (icon.w ?? 1);
  const halfH = 100 * (icon.h ?? 1);
  const out: string[] = [];
  for (const port of icon.ports ?? []) {
    const part = model.components.find((c) => c.name === port.id && model.entries.some((e) => e.name === port.id));
    if (!part) continue;
    const along = port.at / 100;
    const at: [number, number] =
      port.side === "left" ? [-halfW, halfH - along * 2 * halfH]
      : port.side === "right" ? [halfW, halfH - along * 2 * halfH]
      : [-halfW + along * 2 * halfW, port.side === "top" ? halfH : -halfH];
    out.push(x.updateComponent(model.name, part.class, part.name, part.placement, at));
  }
  return out;
}

export function removeEntryExprs(model: StudioModel, entry: string): string[] {
  const wires = model.connections.filter((c) => c.a === entry || c.b === entry);
  return [...wires.map((w) => x.deleteConnection(model.name, w.a, w.b)), x.deleteComponent(model.name, entry)];
}

/** Delete parts (and every wire on them) and the wires picked, wires first. */
export function removeExprs(model: StudioModel, names: string[], wires: Connection[]): string[] {
  const gone = new Set(names);
  const cut = [...wires, ...model.connections.filter((c) => gone.has(split(c.a).part) || gone.has(split(c.b).part))];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of cut) {
    const k = [w.a, w.b].sort().join("|");
    if (!seen.has(k)) out.push(x.deleteConnection(model.name, w.a, w.b));
    seen.add(k);
  }
  return [...out, ...names.map((n) => x.deleteComponent(model.name, n))];
}

/** The nearest free grid spot at or after `from` (a drop, the view's centre): parts never land on one another. */
export function freeSpot(model: StudioModel, from: { x: number; y: number } = { x: 200, y: 160 }): { x: number; y: number; rotation: 0 } {
  const taken = (p: { x: number; y: number }) => model.components.some((c) => Math.abs(c.placement.x - p.x) < 100 && Math.abs(c.placement.y - p.y) < 80);
  const start = { x: x.snap(from.x), y: x.snap(from.y) };
  for (let i = 0; i < 200; i++) {
    const p = { x: start.x + (i % 6) * 140, y: start.y + Math.floor(i / 6) * 120 };
    if (!taken(p)) return { ...p, rotation: 0 };
  }
  return { ...start, rotation: 0 };
}
