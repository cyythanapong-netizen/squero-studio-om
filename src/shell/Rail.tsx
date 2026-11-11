// The left rail: Files (the model's folder, its packages and classes) or the Library (the
// component browser). The tree itself is @paperboat/shared/files, the same component MX uses;
// this file only maps the workspace entries and the Studio actions.
import { useRef, type ReactNode } from "react";
import { FileTree, type FileEntry, type FileTreeHandle } from "@paperboat/shared/files";
import { visibleEntries, workspaceName, type Workspace, type WorkspaceEntry } from "./workspace.ts";

export type RailTab = "files" | "library";

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
  onMove,
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
  onMove: (source: WorkspaceEntry, target?: WorkspaceEntry) => void;
  children: ReactNode;
}) {
  const tree = useRef<FileTreeHandle>(null);
  const entries: FileEntry[] = visibleEntries(workspace?.entries ?? [], new Set()).map((entry) => ({
    path: entry.path,
    name: entry.name,
    depth: entry.depth,
    kind: entry.kind === "package" ? "folder" : "file",
    icon: entry.kind === "package" ? "package" : (entry.classKind ?? "class"),
    badge: entry.kind === "package" ? "package" : "",
  }));
  const find = (entry?: FileEntry) => (entry ? workspace?.entries.find((one) => one.path === entry.path) : undefined);
  const classes = workspace?.entries.filter((entry) => entry.kind === "class").length ?? 0;

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
              tree.current?.openNewMenu(rect.left, rect.bottom + 4);
            }}
          >
            +
          </button>
        )}
      </div>
      <div className="rail-body">
        <div className="files-panel" hidden={tab !== "files"}>
          <div className="files-head">
            <span className="nm" title={workspace?.root}>{workspaceName(workspace)}</span>
            <span className="lbl">{workspace ? (workspace.package ? "package" : "quick") : ""}</span>
          </div>
          <FileTree
            ref={tree}
            entries={entries}
            active={active}
            ariaLabel="Workspace"
            labels={{
              newFile: "New class…",
              newFolder: "New package…",
              duplicate: "Duplicate…",
              delete: "Delete…",
              copyPath: "Copy path",
              empty: "No .mo files here yet. Create a class with +.",
            }}
            actions={{
              onOpen: (entry) => onOpen(entry.path),
              onNewFile: (parent) => onNewClass(find(parent)),
              onNewFolder: (parent) => onNewPackage(find(parent)),
              onDuplicate: (entry) => { const one = find(entry); if (one) onDuplicate(one); },
              onDelete: (entry) => { const one = find(entry); if (one) onDelete(one); },
              onCopyPath: (entry) => { const one = find(entry); if (one) onCopyPath(one); },
              onMove: (source, target) => { const one = find(source); if (one) onMove(one, find(target)); },
            }}
          />
          <p className="files-foot">{classes} {classes === 1 ? "class" : "classes"}</p>
        </div>
        <div className="library-slot" hidden={tab !== "library"}>
          {children}
        </div>
      </div>
    </aside>
  );
}
