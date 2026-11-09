// The left rail: Files (the model's folder, its packages and classes) or the Library (the
// component browser). Both stay mounted, so the library keeps its search and chosen package when
// the rail switches; only the visible one lays out.
//
// A quick model — a .mo outside a package — opens on Library, because there is no package tree
// to read. Opening a folder or a package opens on Files. That is the whole difference between the
// quick path and the authoring path; they are the same shell.

import { useState, type ReactNode } from "react";
import { visibleEntries, workspaceName, type Workspace } from "./workspace.ts";

export type RailTab = "files" | "library";

export function Rail({
  tab,
  onTab,
  workspace,
  active,
  onOpen,
  onNew,
  children,
}: {
  tab: RailTab;
  onTab: (tab: RailTab) => void;
  workspace: Workspace | null;
  active?: string;
  onOpen: (file: string) => void;
  onNew: () => void;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const rows = workspace ? visibleEntries(workspace.entries, collapsed) : [];
  const classes = rows.filter((entry) => entry.kind === "class").length;
  const toggle = (path: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  return (
    <aside className={`rail rail-${tab}`} aria-label="Files and library">
      <div className="rail-tabs" role="tablist" aria-label="Rail">
        <button type="button" role="tab" aria-selected={tab === "files"} className={`rail-tab${tab === "files" ? " on" : ""}`} onClick={() => onTab("files")}>
          files
        </button>
        <button type="button" role="tab" aria-selected={tab === "library"} className={`rail-tab${tab === "library" ? " on" : ""}`} onClick={() => onTab("library")}>
          library
        </button>
        {tab === "files" && (
          <button type="button" className="key small rail-add" title="New class in this workspace" onClick={onNew}>
            +
          </button>
        )}
      </div>
      <div className="rail-body">
        <div className="files-panel" hidden={tab !== "files"}>
          <div className="files-head">
            <span className="nm" title={workspace?.root}>
              {workspaceName(workspace)}
            </span>
            <span className="lbl">{workspace ? (workspace.package ? "package" : "quick") : ""}</span>
          </div>
          {rows.length > 0 ? (
            <div className="files-tree" role="tree" aria-label="Workspace">
              {rows.map((entry) => {
                const here = entry.path === active;
                const open = entry.kind === "package" && !collapsed.has(entry.path);
                return (
                  <button
                    key={entry.path}
                    type="button"
                    role="treeitem"
                    aria-expanded={entry.kind === "package" ? open : undefined}
                    aria-selected={entry.kind === "class" ? here : undefined}
                    className={`file-row${here ? " on" : ""}`}
                    style={{ paddingLeft: 8 + entry.depth * 14 }}
                    title={entry.path}
                    onClick={() => (entry.kind === "package" ? toggle(entry.path) : onOpen(entry.path))}
                  >
                    <span className="caret">{entry.kind === "package" ? (open ? "▾" : "▸") : ""}</span>
                    <span className="nm">{entry.name}</span>
                    <span className="k">{entry.kind === "package" ? "package" : ""}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="files-empty">No .mo files here yet. Create a class with +.</p>
          )}
          <p className="files-foot">
            {classes} {classes === 1 ? "class" : "classes"}
          </p>
        </div>
        <div className="library-slot" hidden={tab !== "library"}>
          {children}
        </div>
      </div>
    </aside>
  );
}
