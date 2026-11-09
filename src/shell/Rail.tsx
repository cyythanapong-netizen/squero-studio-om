// The left rail: Files (the model's folder, its packages and classes) or the Library (the
// component browser). Both stay mounted, so the library keeps its search and chosen package when
// the rail switches; only the visible one lays out.
//
// A quick model — a .mo outside a package — opens on Library, because there is no package tree
// to read. Opening a folder or a package opens on Files. That is the whole difference between the
// quick path and the authoring path; they are the same shell.

import { useEffect, useState, type ReactNode } from "react";
import { visibleEntries, workspaceName, type Workspace, type WorkspaceEntry } from "./workspace.ts";

export type RailTab = "files" | "library";

/** A 13px glyph per class kind, so the tree says what a file is without opening it. */
function KindGlyph({ kind }: { kind: WorkspaceEntry["classKind"] }) {
  const common = { viewBox: "0 0 16 16", "aria-hidden": true } as const;
  switch (kind) {
    case "package":
      return (
        <svg {...common}>
          <path d="M1.5 4.5h4.7l1.3 1.8h7v7.2h-13z" />
        </svg>
      );
    case "model":
      return (
        <svg {...common}>
          <rect x="2.5" y="2.5" width="11" height="11" rx="1.2" />
          <path d="M5.5 8h5" />
        </svg>
      );
    case "block":
      return (
        <svg {...common}>
          <rect x="2.5" y="3.5" width="8" height="9" rx="1.2" />
          <path d="M10.5 8H14M12 6.5 14 8l-2 1.5" />
        </svg>
      );
    case "connector":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="3.6" />
          <circle cx="8" cy="8" r="1" />
        </svg>
      );
    case "record":
      return (
        <svg {...common}>
          <rect x="2.5" y="3" width="11" height="10" rx="1.2" />
          <path d="M2.5 6.5h11M6.5 6.5V13" />
        </svg>
      );
    case "function":
      return (
        <svg {...common}>
          <path d="M9.5 3.5c-1.8 0-2.5 1-2.5 3v6M4.5 8h4M10 8h2.5" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M4 2.5h6l2 2v9H4z" />
          <path d="M10 2.5v2h2" />
        </svg>
      );
  }
}

export function Rail({
  tab,
  onTab,
  workspace,
  active,
  onOpen,
  onNewClass,
  onNewPackage,
  onDuplicate,
  onDelete,
  onCopyPath,
  children,
}: {
  tab: RailTab;
  onTab: (tab: RailTab) => void;
  workspace: Workspace | null;
  active?: string;
  onOpen: (file: string) => void;
  onNewClass: (entry?: WorkspaceEntry) => void;
  onNewPackage: (entry?: WorkspaceEntry) => void;
  onDuplicate: (entry: WorkspaceEntry) => void;
  onDelete: (entry: WorkspaceEntry) => void;
  onCopyPath: (entry: WorkspaceEntry) => void;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [menu, setMenu] = useState<{ entry?: WorkspaceEntry; x: number; y: number } | null>(null);
  const rows = workspace ? visibleEntries(workspace.entries, collapsed) : [];
  const close = () => setMenu(null);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menu]);
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
          <button
            type="button"
            className="key small rail-add"
            title="New class or package"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setMenu({ x: rect.left, y: rect.bottom + 4 });
            }}
          >
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
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setMenu({ entry, x: e.clientX, y: e.clientY });
                    }}
                  >
                    <span className="caret">{entry.kind === "package" ? (open ? "▾" : "▸") : ""}</span>
                    <span className="file-icon" title={entry.kind === "package" ? "package" : (entry.classKind ?? "class")}>
                      <KindGlyph kind={entry.kind === "package" ? "package" : (entry.classKind ?? "class")} />
                    </span>
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
      {menu && (
        <>
          <div className="file-menu-scrim" onPointerDown={close} />
          <div className="file-menu" role="menu" aria-label="Workspace actions" style={{ left: Math.min(menu.x, window.innerWidth - 220), top: Math.min(menu.y, window.innerHeight - 240) }}>
            <button type="button" role="menuitem" onClick={() => { onNewClass(menu.entry); close(); }}>
              New class…
            </button>
            <button type="button" role="menuitem" onClick={() => { onNewPackage(menu.entry); close(); }}>
              New package…
            </button>
            {menu.entry?.kind === "class" && (
              <>
                <hr />
                <button type="button" role="menuitem" onClick={() => { onDuplicate(menu.entry!); close(); }}>
                  Duplicate…
                </button>
                <button type="button" role="menuitem" onClick={() => { onDelete(menu.entry!); close(); }}>
                  Delete…
                </button>
              </>
            )}
            {menu.entry && (
              <>
                <hr />
                <button type="button" role="menuitem" onClick={() => { onCopyPath(menu.entry!); close(); }}>
                  Copy path
                </button>
              </>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
