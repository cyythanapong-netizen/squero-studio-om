import type { Connectors, IconPort } from "@paperboat/shared";
import type { ComponentInst, StudioApi, StudioModel } from "../model/types.ts";

function parseNumber(text: string): number | undefined {
  if (text.trim() === "") return undefined;
  const v = Number(text);
  return Number.isFinite(v) ? v : undefined;
}

const PARAM_UNITS: Record<string, string> = {
  R: "Ohm",
  L: "H",
  C: "F",
  G: "S",
  J: "kg.m2",
  m: "kg",
  c: "N/m",
  d: "N.s/m",
  phi0: "rad",
  w0: "rad/s",
  s0: "m",
  v0: "m/s",
  T: "K",
  T_ref: "K",
  alpha: "1/K",
  V: "V",
  k: "N.m/A",
  f: "Hz",
};

export function paramUnit(paramId: string, model: StudioModel, boundTo?: string | null): string | undefined {
  if (boundTo) {
    const top = model.params.find((p) => p.id === boundTo);
    if (top && top.type === "number" && top.unit) return top.unit;
  }
  const same = model.params.find((p) => p.id === paramId);
  if (same && same.type === "number" && same.unit) return same.unit;
  return PARAM_UNITS[paramId];
}

export type ParsedParam = {
  bound: string | null;
  numeric: number | null;
  modifierText: string;
};

/**
 * Inspects a component modifier string (`"10"`, `"R_load"`, or `"R = R_load"`).
 */
export function parseParamBinding(paramId: string, rawValue: string): ParsedParam {
  const trimmed = rawValue.trim();
  const prefix = new RegExp(`^${paramId}\\s*=\\s*`);
  const rhs = trimmed.replace(prefix, "").trim();
  const num = parseNumber(rhs);
  if (num !== undefined) {
    return { bound: null, numeric: num, modifierText: String(num) };
  }
  if ( rhs.length > 0) {
    return { bound: rhs, numeric: null, modifierText: `${paramId} = ${rhs}` };
  }
  return { bound: null, numeric: 0, modifierText: "0" };
}

export function resolveParamNumber(paramId: string, rawValue: string, model: StudioModel): number {
  const parsed = parseParamBinding(paramId, rawValue);
  if (parsed.numeric !== null) return parsed.numeric;
  if (parsed.bound) {
    const top = model.params.find((p) => p.id === parsed.bound);
    if (top && top.type === "number") return top.default;
  }
  return 0;
}

export async function commitParamValue(
  api: StudioApi,
  componentName: string,
  paramId: string,
  value: number,
): Promise<void> {
  await api.setParam(`${componentName}.${paramId}`, String(value));
}

/** A variable dragged from the sheet onto a parameter field. */
export const VAR_DRAG = "application/x-squero-variable";

/**
 * Binds `componentName.paramId` to the top-level variable `topParamName` (`R = R_load`): the
 * variable is made first, with the field's value, when it isn't there (public = a Station prop).
 */
export async function bindParamToTopLevel(
  api: StudioApi,
  componentName: string,
  paramId: string,
  topParamName: string,
  currentRawValue: string,
  isPrivate = false,
): Promise<boolean> {
  const cleanName = topParamName.trim();
  if (!/^[A-Za-z_]\w*$/.test(cleanName)) return false;
  if (!api.model.params.some((p) => p.id === cleanName))
    await api.addVariable(cleanName, String(resolveParamNumber(paramId, currentRawValue, api.model)), isPrivate);
  await api.setParam(`${componentName}.${paramId}`, cleanName);
  return true;
}

export async function unbindParam(
  api: StudioApi,
  componentName: string,
  paramId: string,
  boundName: string,
): Promise<void> {
  const top = api.model.params.find((p) => p.id === boundName);
  const fallback = top && top.type === "number" ? String(top.default) : "0";
  await api.setParam(`${componentName}.${paramId}`, fallback);
}

export type PortAction = {
  portId: string;
  portClass: string;
  kind: "input" | "output";
  /** Only a signal port takes + Input / + Probe; a pin needs a sensor first. */
  causal: boolean;
  buttonLabel: "+ Input" | "+ Probe";
  unit?: string;
  existingEntry?: string;
};

export function portActionFor(
  component: ComponentInst,
  port: IconPort,
  connectors: Connectors,
  entries: StudioModel["entries"],
): PortAction {
  const conn = connectors[port.class];
  const isCausalInput = conn?.kind === "input" || /Input$/.test(port.class);
  const causal = isCausalInput || conn?.kind === "output" || /Output$/.test(port.class);
  const kind: "input" | "output" = isCausalInput ? "input" : "output";
  const buttonLabel = isCausalInput ? "+ Input" : "+ Probe";
  const unit = conn?.potential?.[0]?.unit ?? conn?.flow?.[0]?.unit;
  const target = `${component.name}.${port.id}`;
  const existing = entries.find((e) => e.target === target)?.name;
  return {
    portId: port.id,
    portClass: port.class,
    kind,
    causal,
    buttonLabel,
    unit,
    existingEntry: existing,
  };
}

export async function exposeComponentPort(
  api: StudioApi,
  component: ComponentInst,
  port: IconPort,
): Promise<void> {
  const action = portActionFor(component, port, api.model.connectors, api.model.entries);
  await api.addEntry(action.kind, `${component.name}.${port.id}`);
}

export type Box = { x: number; y: number; w: number; h: number };

/** Where the popover goes, in the container's pixels: right of the block, or left when it would
 *  run off the container, then clamped inside it. `node` is the block's box on screen. */
export function popoverSpot(node: Box, pop: { w: number; h: number }, box: { w: number; h: number }, gap = 8): { left: number; top: number } {
  let left = node.x + node.w + gap;
  if (left + pop.w > box.w) left = node.x - pop.w - gap;
  const clamp = (v: number, size: number, max: number) => Math.max(8, Math.min(v, max - size - 8));
  return { left: clamp(left, pop.w, box.w), top: clamp(node.y, pop.h, box.h) };
}
