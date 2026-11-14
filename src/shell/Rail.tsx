// The left rail: Files (the model's folder, its packages and classes), the Library (the
// component browser) or Packages (the Modelica libraries to install). The rail and tree are @paperboat/shared/files (FileRail, FileTree), the same
// as MX; this file only maps the workspace entries and the Studio actions.
import { useRef, type ReactNode } from "react";
import { FileRail, FileTree, type FileEntry, type FileTreeHandle } from "@paperboat/shared/files";
import { gitMark, visibleEntries, workspaceName, type GitState, type Workspace, type WorkspaceEntry } from "./workspace.ts";

export type RailTab = "files" | "library" | "packages";

export function Rail({
  tab,
  onTab,
  workspace,
  git,
  active,
  onOpen,
  onNewClass,
  onNewPackage,
  onDuplicate,
  onRename,
  onDelete,
  onCopyPath,
  onMove,
  collapsed,
  onToggle,
  children,
  packages,
}: {
  tab: RailTab;
  onTab: (tab: RailTab) => void;
  workspace: Workspace | null;
  /** M/U marks on class rows. */
  git?: GitState | null;
  active?: string;
  onOpen: (file: string) => void;
  onNewClass: (entry?: WorkspaceEntry) => void;
  onNewPackage: (entry?: WorkspaceEntry) => void;
  onDuplicate: (entry: WorkspaceEntry) => void;
  onRename: (entry: WorkspaceEntry) => void;
  onDelete: (entry: WorkspaceEntry) => void;
  onCopyPath: (entry: WorkspaceEntry) => void;
  onMove: (source: WorkspaceEntry, target?: WorkspaceEntry) => void;
  /** Folded to a standing tab. */
  collapsed?: boolean;
  onToggle?: () => void;
  children: ReactNode;
  /** The packages tab: the Modelica libraries in the shared package panel. */
  packages?: ReactNode;
}) {
  const tree = useRef<FileTreeHandle>(null);
  const entries: FileEntry[] = visibleEntries(workspace?.entries ?? [], new Set()).map((entry) => ({
    path: entry.path,
    name: entry.name,
    depth: entry.depth,
    kind: entry.kind === "package" ? "folder" : "file",
    icon: entry.kind === "package" ? "package" : (entry.classKind ?? "class"),
    badge: entry.kind === "package" ? "package" : gitMark(git, entry.path),
  }));
  const find = (entry?: FileEntry) => (entry ? workspace?.entries.find((one) => one.path === entry.path) : undefined);
  const classes = workspace?.entries.filter((entry) => entry.kind === "class").length ?? 0;

  return (
    <FileRail
      label="Files and library"
      className={`rail-${tab}`}
      tabs={packages ? ["files", "library", "packages"] : ["files", "library"]}
      tab={tab}
      onTab={(next) => onTab(next as RailTab)}
      onAdd={(x, y) => tree.current?.openNewMenu(x, y)}
      addTitle="New class or package"
      name={workspaceName(workspace)}
      nameTitle={workspace?.root}
      badge={workspace ? (workspace.package ? "package" : "quick") : ""}
      foot={`${classes} ${classes === 1 ? "class" : "classes"}`}
      collapsed={collapsed}
      onToggle={onToggle}
      tree={
        <FileTree
          ref={tree}
          entries={entries}
          active={active}
          ariaLabel="Workspace"
          labels={{
            newFile: "New class…",
            newFolder: "New package…",
            rename: "Rename…",
            duplicate: "Duplicate…",
            delete: "Delete…",
            copyPath: "Copy path",
            empty: "No .mo files here yet. Create a class with +.",
          }}
          actions={{
            onOpen: (entry) => onOpen(entry.path),
            onNewFile: (parent) => onNewClass(find(parent)),
            onNewFolder: (parent) => onNewPackage(find(parent)),
            onRename: (entry) => { const one = find(entry); if (one) onRename(one); },
            onDuplicate: (entry) => { const one = find(entry); if (one) onDuplicate(one); },
            onDelete: (entry) => { const one = find(entry); if (one) onDelete(one); },
            onCopyPath: (entry) => { const one = find(entry); if (one) onCopyPath(one); },
            onMove: (source, target) => { const one = find(source); if (one) onMove(one, find(target)); },
          }}
        />
      }
    >
      <div className="library-slot" hidden={tab !== "library"}>
        {children}
      </div>
      {packages && (
        <div className="library-slot packages-slot" hidden={tab !== "packages"}>
          {tab === "packages" && packages}
        </div>
      )}
    </FileRail>
  );
}
