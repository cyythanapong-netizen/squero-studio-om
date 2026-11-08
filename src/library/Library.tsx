// The Component Browser (squero#12): Paperboat-style card-based component browser.
// Displays Modelica components with vector thumbnails, category badges, docstrings,
// connector summaries, domain tabs, instant search scoring, and drag-and-drop.

import { GlideBrackets, Icon } from "@paperboat/shared/components";
import type { IconDef, IconPort } from "@paperboat/shared";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import type { OmcClient } from "../omc/omc.ts";
import { atom, list, parseValue } from "../omc/parse.ts";
import {
  DEFAULT_MSL_CLASSES,
  STANDARD_CATEGORIES,
  categoriesOf,
  flat,
  makeComponentItem,
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

/** The modern card-based component browser (squero#12). */
export function Library({ omc, model, onPlace }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [mine, setMine] = useState<string[]>([]);
  const index = useClassIndex(omc);

  const loadProjectClasses = useCallback(async () => {
    try {
      const tops = list(parseValue(await omc.call("getClassNames()"))).map(atom);
      setMine(tops.filter((n) => n && !["Modelica", "ModelicaServices", "Complex", model].includes(n)));
    } catch {
      // Offline or mock
    }
  }, [omc, model]);

  useEffect(() => {
    void loadProjectClasses();
  }, [loadProjectClasses]);

  // Transform class index and project classes into ComponentCardItems
  const allItems = useMemo<ComponentCardItem[]>(() => {
    const mslItems = index.map((cls) => makeComponentItem(cls));
    const projectItems = mine.map((cls) => ({
      name: cls,
      full: cls,
      category: "Project",
      subpackage: "Project",
      comment: "User-defined project model",
    }));
    return [...projectItems, ...mslItems];
  }, [index, mine]);

  // Dynamic category list
  const categories = useMemo<string[]>(() => {
    const cats: string[] = [...STANDARD_CATEGORIES];
    if (mine.length > 0) cats.push("Project");
    return cats;
  }, [mine.length]);

  // Filter and fuzzy search
  const filteredItems = useMemo<ComponentCardItem[]>(() => {
    return searchComponents(allItems, query, category);
  }, [allItems, query, category]);

  // Count items per category
  const counts = useMemo<Record<string, number>>(() => {
    const c: Record<string, number> = { All: allItems.length };
    for (const it of allItems) {
      for (const cat of categoriesOf(it.full)) {
        c[cat] = (c[cat] ?? 0) + 1;
      }
      if (it.category === "Project") {
        c["Project"] = (c["Project"] ?? 0) + 1;
      }
    }
    return c;
  }, [allItems]);

  return (
    <nav className="library" aria-label="Component library">
      {/* Search Header */}
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
            aria-label="Search components"
          />
          {query && (
            <button
              type="button"
              className="lib-clear-btn"
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </span>
        <span className="lbl lib-count">
          {filteredItems.length} {filteredItems.length === 1 ? "match" : "matches"}
        </span>
      </div>

      {/* Domain Category Tabs */}
      <div className="lib-tabs glide" role="tablist" aria-label="Component domain categories">
        {categories.map((cat) => (
          <button
            key={cat}
            role="tab"
            aria-selected={category === cat}
            className={`lib-tab opt${category === cat ? " on" : ""}`}
            onClick={() => setCategory(cat)}
          >
            <span>{cat}</span>
            {counts[cat] !== undefined && <span className="lib-tab-num">{counts[cat]}</span>}
          </button>
        ))}
        <GlideBrackets />
      </div>

      {/* Cards List */}
      <div className="lib-cards" role="list" aria-label="Components list">
        {filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <ComponentCard key={item.full} item={item} omc={omc} onPlace={onPlace} />
          ))
        ) : (
          <div className="lib-empty">
            <p className="empty-title">Nothing matches “{query}”</p>
            <p className="empty-hint">Try searching a different domain, connector, or clearing the filter.</p>
            {category !== "All" && (
              <button type="button" className="key small" onClick={() => setCategory("All")}>
                View all categories
              </button>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
