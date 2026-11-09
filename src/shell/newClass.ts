// New class rules: the five Modelica kinds, the skeleton each gets, and where a new file goes in
// the workspace. Pure, so the sheet's preview and the server's write can be checked without a DOM.

import type { Workspace, WorkspaceEntry } from "./workspace.ts";

export type ClassKind = "model" | "block" | "connector" | "record" | "function";

/** What the sheet asks the server to write. */
export type NewClassSpec = { file: string; name: string; kind: ClassKind; within: string; base?: string };

export const KINDS: { kind: ClassKind; label: string; hint: string }[] = [
  { kind: "model", label: "model", hint: "parts, equations, connectors" },
  { kind: "block", label: "block", hint: "causal inputs and outputs" },
  { kind: "connector", label: "connector", hint: "potential and flow variables" },
  { kind: "record", label: "record", hint: "typed parameter fields" },
  { kind: "function", label: "function", hint: "algorithm with inputs" },
];

/** The qualified package of an entry, from its path under the workspace root. */
export function packageName(root: string, path: string): string {
  const rel = path.startsWith(root) ? path.slice(root.length) : path;
  return rel.split(/[\\/]/).filter(Boolean).join(".");
}

/** The package the open model lives in, so New Class defaults beside it. */
export function defaultWithin(model: { name: string }): string {
  const at = model.name.lastIndexOf(".");
  return at > 0 ? model.name.slice(0, at) : "";
}

/** Workspace root first, then every package in tree order. */
export function packageOptions(workspace: Workspace | null): { value: string; label: string }[] {
  if (!workspace) return [{ value: "", label: "workspace root" }];
  return [
    { value: "", label: "workspace root" },
    ...workspace.entries
      .filter((entry): entry is WorkspaceEntry & { kind: "package" } => entry.kind === "package")
      .map((entry) => {
        const name = packageName(workspace.root, entry.path);
        return { value: name, label: name };
      }),
  ];
}

/** Where the new `.mo` goes: the chosen package's folder, else the workspace root. */
export function fileFor(workspace: Workspace | null, within: string, name: string): string {
  const root = workspace?.root ?? "";
  const dir = within ? (workspace?.entries.find((e) => e.kind === "package" && packageName(root, e.path) === within)?.path ?? root) : root;
  return `${dir.replace(/[\\/]$/, "")}/${name}.mo`;
}

/** The class text the server writes: same shape as the sheet's preview. */
export function skeleton(kind: ClassKind, name: string, within: string, base = ""): string {
  const head = within ? `within ${within};\n\n` : "";
  const ext = base ? `  extends ${base};\n` : "";
  const body: Record<ClassKind, string> = {
    model: "  Real x;\nequation\n  der(x) = -x;\n",
    block: "  Modelica.Blocks.Interfaces.RealInput u;\n  Modelica.Blocks.Interfaces.RealOutput y;\nequation\n  y = u;\n",
    connector: "  Real v;\n  flow Real i;\n",
    record: "  Real x;\n",
    function: "  input Real u;\n  output Real y;\nalgorithm\n  y := u;\n",
  };
  return `${head}${kind} ${name}\n  "A new ${kind}."\n${ext}${body[kind]}end ${name};\n`;
}
