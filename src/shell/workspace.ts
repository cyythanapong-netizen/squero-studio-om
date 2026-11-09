// The Files rail's data: the server's workspace listing, and the small rules the rail and the
// document tabs need. Pure, so the tree logic is testable without a DOM.

/** The class keyword the .mo declares, for the rail's glyph. */
export type ClassKind = "model" | "block" | "connector" | "record" | "function" | "package" | "class";

export type WorkspaceEntry = {
  name: string;
  path: string;
  kind: "package" | "class";
  /** What a class file declares; absent on a package row. */
  classKind?: ClassKind;
  /** 0 for the top package or a loose class, +1 per package level. */
  depth: number;
};

export type Workspace = {
  root: string;
  /** The .mo the workspace was read for. */
  file: string;
  /** True when the file sits in a Modelica package (a folder with package.mo). */
  package: boolean;
  entries: WorkspaceEntry[];
};

/** One open document: the .mo on disk and the class it holds. */
export type Doc = { file: string; name: string };

/** The folder's name, for the rail's head. */
export function workspaceName(workspace: Workspace | null): string {
  if (!workspace) return "workspace";
  const parts = workspace.root.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? workspace.root;
}

/** A collapsed package hides the entries below it; a sibling at its depth shows again. */
export function visibleEntries(entries: WorkspaceEntry[], collapsed: ReadonlySet<string>): WorkspaceEntry[] {
  const out: WorkspaceEntry[] = [];
  let hiddenBelow: number | null = null;
  for (const entry of entries) {
    if (hiddenBelow !== null && entry.depth > hiddenBelow) continue;
    hiddenBelow = null;
    out.push(entry);
    if (entry.kind === "package" && collapsed.has(entry.path)) hiddenBelow = entry.depth;
  }
  return out;
}

/** Opens a document, or updates its name, keeping the order the user opened it in. */
export function openDoc(docs: Doc[], doc: Doc): Doc[] {
  return docs.some((d) => d.file === doc.file) ? docs.map((d) => (d.file === doc.file ? doc : d)) : [...docs, doc];
}

export function closeDoc(docs: Doc[], file: string): Doc[] {
  return docs.filter((d) => d.file !== file);
}

/** Where to go when the active document closes: the next tab, else the previous, else none. */
export function neighbour(docs: Doc[], file: string): Doc | undefined {
  const at = docs.findIndex((d) => d.file === file);
  if (at < 0) return undefined;
  return docs[at + 1] ?? docs[at - 1];
}
