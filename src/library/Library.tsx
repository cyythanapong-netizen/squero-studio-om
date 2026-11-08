// The component browser: a package tree, and the cards of the chosen package (or of a search)
// in a column beside it: vector thumbnails, docstrings, connector summaries, drag-and-drop.

import { Icon } from "@paperboat/shared/components";
import type { IconDef, IconPort } from "@paperboat/shared";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import type { OmcClient } from "../omc/omc.ts";
import { atom, list, parseValue } from "../omc/parse.ts";
import {
  DEFAULT_MSL_CLASSES,
  children,
  flat,
  makeComponentItem,
  packageCounts,
  searchComponents,
  type ComponentCardItem,
  type ComponentPortSummary,
} from "./classes.ts";

export const DRAG_TYPE = "application/x-squero-class";

type Props = {
  omc: OmcClient;
  model: string;
  onPlace: (cls: string) => void;
};

/** A part's icon, fetched lazily when its card scrolls into view. */
export function Thumb({
  omc,
  cls,
  onLoaded,
}: {
  omc: OmcClient;
  cls: string;
  onLoaded?: (ports?: IconPort[]) => void;
}) {
  const [icon, setIcon] = useState<IconDef>();
  const [seen, setSeen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const watch = new IntersectionObserver((e) => {
      if (e.some((x) => x.isIntersecting)) {
        setSeen(true);
        watch.disconnect();
      }
    });
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  useEffect(() => {
    if (!seen) return;
    let live = true;
    omc
      .op<{ icon?: IconDef }>("icon", { class: cls })
      .then(
        (r) => {
          if (!live) return;
          setIcon(r.icon);
          if (r.icon?.ports) onLoaded?.(r.icon.ports);
        },
        () => undefined,
      );
    return () => {
      live = false;
    };
  }, [omc, cls, seen, onLoaded]);

  return (
    <span className="thumb" ref={box}>
      {icon ? <Icon icon={icon} type={cls} fill={(t) => (t.includes("{") ? "" : t)} /> : null}
    </span>
  );
}

/** Summarizes connector ports: causal inputs -> outputs or acausal pins/flanges. */
export function PortSummary({ ports }: { ports?: ComponentPortSummary[] }) {
  if (!ports || ports.length === 0) return null;
  const ins = ports.filter((p) => p.kind === "input" || p.class?.includes("Input"));
  const outs = ports.filter((p) => p.kind === "output" || p.class?.includes("Output"));
  const isCausal = ins.length > 0 || outs.length > 0;

  if (isCausal) {
    return (
      <div className="card-ports">
        <span className="ins">
          {ins.length ? (
            ins.map((p) => (
              <span key={p.id} className="card-port in">
                <i />
                {p.id}
              </span>
            ))
          ) : (
            <span className="none">–</span>
          )}
        </span>
        <span className="arrow">→</span>
        <span className="outs">
          {outs.length ? (
            outs.map((p) => (
              <span key={p.id} className="card-port out">
                {p.id}
                <i />
              </span>
            ))
          ) : (
            <span className="none">–</span>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="card-connectors">
      {ports.slice(0, 5).map((p) => (
        <span key={p.id} className="connector-pill" title={`${p.id} (${p.class ?? "port"})`}>
          <span className="pin-dot" />
          {p.id}
        </span>
      ))}
      {ports.length > 5 && <span className="connector-more">+{ports.length - 5}</span>}
    </div>
  );
}

/** A single rich component card matching Paperboat's Browser.tsx aesthetic. */
export function ComponentCard({
  item,
  omc,
  onPlace,
}: {
  item: ComponentCardItem;
  omc: OmcClient;
  onPlace: (cls: string) => void;
}) {
  const [livePorts, setLivePorts] = useState<ComponentPortSummary[] | undefined>(item.ports);

  const handlePortsLoaded = useCallback((ports?: IconPort[]) => {
    if (ports && ports.length > 0) {
      setLivePorts(
        ports.map((p) => ({
          id: p.id,
          side: p.side,
          class: p.class,
          kind: p.class?.includes("Input") ? "input" : p.class?.includes("Output") ? "output" : "acausal",
        })),
      );
    }
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPlace(item.full);
    }
  };

  const handleAddClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onPlace(item.full);
  };

  return (
    <div
      className="card squero-card"
      draggable
      tabIndex={0}
      title={`Drag onto canvas, or double-click to place\n${item.full}${item.comment ? `\n\n${item.comment}` : ""}`}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, item.full);
        e.dataTransfer.effectAllowed = "copy";
        setTimeout(() => document.body.classList.add("dragging-card"));
      }}
      onDragEnd={() => {
        document.body.classList.remove("dragging-card");
      }}
      onDoubleClick={() => onPlace(item.full)}
      onKeyDown={handleKeyDown}
      role="listitem"
    >
      <div className="card-head">
        <Thumb omc={omc} cls={item.full} onLoaded={handlePortsLoaded} />
        <div className="card-title-col">
          <b className="card-name">{item.name}</b>
          <span className="card-sub" title={item.full}>
            {item.subpackage}
          </span>
        </div>
        <span className="lbl card-badge">{item.category}</span>
      </div>

      {item.comment ? <p className="card-desc">{item.comment}</p> : null}

      <PortSummary ports={livePorts} />

      <div className="card-foot">
        <span className="lbl card-hint">{item.name}</span>
        <button
          type="button"
          className="key small add-btn"
          title={`Add ${item.name} to canvas`}
          onClick={handleAddClick}
        >
          + Add
        </button>
      </div>
    </div>
  );
}

/** Hook providing all indexed class names for `/` quick-add and search. */
export function useClassIndex(omc: OmcClient): string[] {
  const [names, setNames] = useState<string[]>([]);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    flat(omc, "Modelica").then(
      (n) => setNames(n && n.length > 0 ? n : DEFAULT_MSL_CLASSES),
      () => setNames(DEFAULT_MSL_CLASSES),
    );
  }, [omc]);

  return names.length > 0 ? names : DEFAULT_MSL_CLASSES;
}

type Node = { name: string; full: string };

/** One package row; its sub-packages load when it opens. Parts never show in the tree. */
function TreeNode({
  omc,
  node,
  depth,
  chosen,
  hits,
  counts,
  onChoose,
}: {
  omc: OmcClient;
  node: Node;
  depth: number;
  chosen: string | null;
  hits: Set<string>;
  counts: Map<string, number>;
  onChoose: (full: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [kids, setKids] = useState<Node[] | null>(node.full === PROJECT ? [] : null);
  useEffect(() => {
    if (!open || kids) return;
    children(omc, node.full).then(
      (es) => setKids(es.filter((e) => e.kind === "package" && (!counts.has(node.full) || counts.has(e.full)))),
      () => setKids([]),
    );
  }, [open, kids, omc, node.full, counts]);
  const leaf = kids !== null && kids.length === 0;
  return (
    <>
      <div
        role="treeitem"
        aria-expanded={leaf ? undefined : open}
        aria-selected={chosen === node.full}
        className={`tree-row${chosen === node.full ? " on" : ""}${hits.has(node.full) ? " hit" : ""}`}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        <button type="button" className="tree-caret" tabIndex={-1} aria-hidden="true" onClick={() => setOpen((o) => !o)}>
          {leaf ? "" : open ? "▾" : "▸"}
        </button>
        <button type="button" className="tree-name" onClick={() => onChoose(node.full)} onDoubleClick={() => setOpen((o) => !o)}>
          {node.name}
        </button>
        {counts.has(node.full) && <span className="tree-num">{counts.get(node.full)}</span>}
      </div>
      {open &&
        kids?.map((k) => (
          <TreeNode key={k.full} omc={omc} node={k} depth={depth + 1} chosen={chosen} hits={hits} counts={counts} onChoose={onChoose} />
        ))}
    </>
  );
}

/** The component browser (squero#17): a tree of packages; choosing one, or searching, opens the
 *  cards of its parts in a second column to the right. A search lights the packages holding a hit. */
export function Library({ omc, model, onPlace }: Props) {
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const [mine, setMine] = useState<string[]>([]);
  const [minePackages, setMinePackages] = useState<Record<string, string[]>>({});
  const index = useClassIndex(omc);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const tops = list(parseValue(await omc.call("getClassNames()"))).map(atom);
        const own = tops.filter((n) => n && !["Modelica", "ModelicaServices", "Complex", "OpenModelica", model].includes(n));
        const pkgs: Record<string, string[]> = {};
        const plain: string[] = [];
        for (const n of own) {
          const restriction = atom(parseValue(await omc.call(`getClassRestriction(${n})`).catch(() => '""')));
          if (restriction === "package") pkgs[n] = await flat(omc, n).catch(() => []);
          else plain.push(n);
        }
        if (live) (setMine(plain), setMinePackages(pkgs));
      } catch {
        // offline or mock
      }
    })();
    return () => {
      live = false;
    };
  }, [omc, model]);

  const roots = useMemo<Node[]>(
    () => [{ name: "Modelica", full: "Modelica" }, ...Object.keys(minePackages).map((n) => ({ name: n, full: n })), ...(mine.length ? [{ name: "Project", full: PROJECT }] : [])],
    [minePackages, mine.length],
  );

  const allItems = useMemo<ComponentCardItem[]>(
    () => [
      ...mine.map((cls) => ({ name: cls, full: cls, category: "Project", subpackage: "Project", comment: "Model in this project" })),
      ...Object.values(minePackages).flat().map((cls) => makeComponentItem(cls)),
      ...index.map((cls) => makeComponentItem(cls)),
    ],
    [index, mine, minePackages],
  );

  const projectSet = useMemo(() => new Set(mine), [mine]);
  const counts = useMemo(() => packageCounts(allItems.map((i) => (projectSet.has(i.full) ? `${PROJECT}.${i.full}` : i.full))), [allItems, projectSet]);

  const searching = query.trim() !== "";
  const results = useMemo(() => (searching ? searchComponents(allItems, query) : []), [allItems, query, searching]);
  const hits = useMemo(() => new Set(packageCounts(results.map((i) => (projectSet.has(i.full) ? `${PROJECT}.${i.full}` : i.full))).keys()), [results, projectSet]);
  const shown = useMemo(() => {
    if (searching) return chosen ? results.filter((i) => inPackage(i.full, chosen, projectSet)) : results;
    return chosen ? allItems.filter((i) => inPackage(i.full, chosen, projectSet)) : [];
  }, [searching, results, allItems, chosen, projectSet]);
  const panel = searching || chosen !== null;

  return (
    <nav className={`library${panel ? " with-cards" : ""}`} aria-label="Component library">
      <div className="lib-tree-col">
        <div className="lib-search-bar">
          <span className="well search-well">
            <span className="search-glyph" aria-hidden="true">
              ⌕
            </span>
            <input
              className="lib-filter"
              type="search"
              placeholder="Search components, ports, domains…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && (setQuery(""), setChosen(null))}
              aria-label="Search components"
            />
            {query && (
              <button type="button" className="lib-clear-btn" onClick={() => setQuery("")} aria-label="Clear search">
                ×
              </button>
            )}
          </span>
        </div>
        <div className="lib-tree" role="tree" aria-label="Packages">
          {roots.map((r) => (
            <TreeNode
              key={r.full}
              omc={omc}
              node={r}
              depth={0}
              chosen={chosen}
              hits={hits}
              counts={counts}
              onChoose={(full) => setChosen((c) => (c === full ? null : full))}
            />
          ))}
        </div>
      </div>

      {panel && (
        <section className="lib-cards-col" aria-label="Components">
          <header className="lib-cards-head">
            <span className="lib-cards-title" title={chosen ?? undefined}>
              {searching ? `“${query.trim()}”${chosen ? ` in ${shortPkg(chosen)}` : ""}` : shortPkg(chosen!)}
            </span>
            <span className="lbl lib-count">{shown.length}</span>
            <button type="button" className="lib-clear-btn" aria-label="Close components" onClick={() => (setQuery(""), setChosen(null))}>
              ×
            </button>
          </header>
          <div className="lib-cards" role="list" aria-label="Components list">
            {shown.length > 0 ? (
              shown.slice(0, 300).map((item) => <ComponentCard key={item.full} item={item} omc={omc} onPlace={onPlace} />)
            ) : (
              <div className="lib-empty">
                <p className="empty-title">{searching ? `Nothing matches “${query.trim()}”` : "No parts here"}</p>
                {chosen && searching && (
                  <button type="button" className="key small" onClick={() => setChosen(null)}>
                    Search everywhere
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </nav>
  );
}

const PROJECT = "\u0000project";
const shortPkg = (full: string) => (full === PROJECT ? "Project" : full.replace(/^Modelica\./, ""));
const inPackage = (full: string, pkg: string, project: Set<string>) => (pkg === PROJECT ? project.has(full) : full.startsWith(`${pkg}.`));
