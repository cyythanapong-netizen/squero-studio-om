// The Variables tree: every top-level variable, then each component and its parameters. Edit mode
// is OMEdit's variable browser; passthrough mode is Paperboat's: a top-level parameter with its
// checkbox on becomes a Station property the runtime can set.

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { NumberField } from "@paperboat/shared/components";
import type { OmcClient } from "../omc/omc.ts";
import { atom, list, parseValue } from "../omc/parse.ts";
import type { ComponentInst, ModelVar, Param, StudioModel } from "../model/types.ts";
import { useStudio } from "../model/types.ts";

type Mode = "edit" | "passthrough";

const shortName = (cls: string) => cls.slice(cls.lastIndexOf(".") + 1);
const PRIMITIVE = new Set(["Real", "Integer", "Boolean", "String"]);

type ClassVar = { name: string; type: string; variability: string; causality: string; visibility: "public" | "protected"; comment?: string };

// One getComponents per class, once per session: a component's variables do not change under us.
const classVars = new Map<string, Promise<ClassVar[]>>();
const restrictions = new Map<string, Promise<string>>();

function restrictionOf(omc: OmcClient, cls: string): Promise<string> {
  let got = restrictions.get(cls);
  if (!got) {
    got = omc.call(`getClassRestriction(${cls})`).then((raw) => atom(parseValue(raw)), () => "");
    restrictions.set(cls, got);
  }
  return got;
}

function loadClassVars(omc: OmcClient, cls: string): Promise<ClassVar[]> {
  let got = classVars.get(cls);
  if (got) return got;
  got = (async () => {
    const rows = list(parseValue(await omc.call(`getComponents(${cls})`).catch(() => "{}")));
    const out: ClassVar[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      const c = list(row);
      const type = atom(c[0]);
      const name = atom(c[1]);
      if (!type || !name || seen.has(name)) continue;
      const variability = atom(c[8]);
      const isPrimitive = PRIMITIVE.has(type);
      if (!isPrimitive && variability !== "parameter" && variability !== "constant") {
        const restriction = await restrictionOf(omc, type);
        if (restriction !== "type" && restriction !== "connector") continue;
      }
      seen.add(name);
      out.push({
        name,
        type: shortName(type),
        variability,
        causality: atom(c[10]),
        visibility: atom(c[3]) === "protected" ? "protected" : "public",
        ...(atom(c[2]) ? { comment: atom(c[2]) } : {}),
      });
    }
    return out;
  })().catch(() => [] as ClassVar[]);
  classVars.set(cls, got);
  return got;
}

function kindOf(v: ModelVar): string {
  if (v.causality === "input" || v.causality === "output") return v.causality;
  if (v.variability && v.variability !== "unspecified") return v.variability;
  return "variable";
}

function VarIcon({ v }: { v: ModelVar }) {
  const kind = kindOf(v);
  return (
    <span className={`var-kind var-kind-${kind}`} title={kind}>
      {kind === "input" ? "→" : kind === "output" ? "←" : kind === "parameter" ? "p" : kind === "constant" ? "c" : "x"}
    </span>
  );
}

function Value({
  param,
  value,
  mode,
  onError,
}: {
  param?: Param;
  value?: string;
  mode: Mode;
  onError: (words: string) => void;
}) {
  const api = useStudio();
  const [draft, setDraft] = useState<string | null>(null);
  if (!param || mode === "passthrough") return <span className="var-value">{value ?? "—"}</span>;
  const shown = draft ?? String(param.default);
  const commit = (next: string) => {
    setDraft(null);
    if (next === String(param.default)) return;
    void api.setParam(param.id, next).catch((e: Error) => onError(e.message));
  };
  if (param.type === "number") {
    return (
      <NumberField
        className="var-value-input"
        aria-label={`Value of ${param.id}`}
        value={Number(param.default)}
        onChange={(v) => setDraft(String(v))}
        onBlur={() => draft !== null && commit(draft)}
      />
    );
  }
  if (param.type === "boolean") {
    return (
      <input
        type="checkbox"
        aria-label={`Value of ${param.id}`}
        checked={param.default === true}
        onChange={(e) => void api.setParam(param.id, String(e.target.checked)).catch((err: Error) => onError(err.message))}
      />
    );
  }
  return (
    <input
      className="var-value-input"
      aria-label={`Value of ${param.id}`}
      value={shown}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== null && commit(draft)}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}

function VarRow({ v, param, mode, onError }: { v: ModelVar; param?: Param; mode: Mode; onError: (words: string) => void }) {
  const api = useStudio();
  const kind = kindOf(v);
  return (
    <div className={`var-row${v.visibility === "protected" ? " protected" : ""}`} role="treeitem">
      <VarIcon v={v} />
      {mode === "edit" && param ? (
        <input
          className="var-name-input"
          aria-label={`Name of ${param.id}`}
          defaultValue={param.id}
          spellCheck={false}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          onBlur={(e) => {
            const to = e.currentTarget.value.trim();
            if (to && to !== param.id) void api.renameVariable(param.id, to).catch((err: Error) => onError(err.message));
            else e.currentTarget.value = param.id;
          }}
        />
      ) : (
        <span className="var-name" title={v.comment ?? v.name}>
          {v.name}
        </span>
      )}
      <span className="var-type" title={v.type}>
        {v.type}
      </span>
      <span className={`var-tag ${kind}`}>{kind}</span>
      {v.visibility === "protected" && <span className="var-tag protected">protected</span>}
      <Value param={param} value={v.value} mode={mode} onError={onError} />
      {mode === "passthrough" ? (
        param ? (
          <button
            type="button"
            className={`var-pass${param.private ? "" : " on"}`}
            aria-pressed={!param.private}
            title={param.private ? "Not passed to Paperboat. Click to expose it as a Station property." : "Passed to Paperboat as a Station property at run time. Click to keep it inside the model."}
            onClick={() => void api.setPrivate(param.id, !param.private).catch((e: Error) => onError(e.message))}
          >
            {param.private ? "off" : "passthrough"}
          </button>
        ) : (
          <span className="var-pass-na" title="Only parameters can be passed; states and inputs are computed by the model.">
            —
          </span>
        )
      ) : param ? (
        <button
          type="button"
          className="var-remove"
          title={`Remove ${param.id}`}
          onClick={() => void api.removeVariable(param.id).catch((e: Error) => onError(e.message))}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

function ComponentRows({ component, mode }: { component: ComponentInst; mode: Mode }) {
  const api = useStudio();
  const [vars, setVars] = useState<ClassVar[] | null>(null);
  useEffect(() => {
    let live = true;
    void loadClassVars(api.omc, component.class).then((rows) => live && setVars(rows));
    return () => {
      live = false;
    };
  }, [api.omc, component.class]);
  const value = (name: string) => component.params[name] ?? component.defaults?.[name] ?? "—";
  if (!vars) return <p className="var-empty">reading {shortName(component.class)}…</p>;
  if (!vars.length) return <p className="var-empty">No variables in {shortName(component.class)}.</p>;
  return (
    <>
      {vars.map((v) => {
        const kind = kindOf(v as ModelVar);
        const has = v.variability === "parameter" || v.variability === "constant";
        return (
          <div className="var-row component-row" key={v.name} role="treeitem">
            <span className={`var-kind var-kind-${kind}`} title={kind}>{kind === "input" ? "→" : kind === "output" ? "←" : has ? "p" : "x"}</span>
            <span className="var-name" title={v.comment ?? v.name}>{v.name}</span>
            <span className="var-type" title={v.type}>{v.type}</span>
            <span className={`var-tag ${kind}`}>{kind}</span>
            {v.visibility === "protected" && <span className="var-tag protected">protected</span>}
            <span className="var-value">{has ? value(v.name) : "—"}</span>
            {mode === "passthrough" ? (
              <span className="var-pass-na" title="Nested variables stay inside the model; passthrough is for the model's own top-level parameters.">
                —
              </span>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

export function VariablesTree({ model, mode }: { model: StudioModel; mode: Mode }) {
  const api = useStudio();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState("");
  const needle = useDeferredValue(query.trim().toLowerCase());
  const params = useMemo(() => new Map(model.params.map((p) => [p.id, p])), [model.params]);
  const vars = useMemo<ModelVar[]>(
    () =>
      model.vars ??
      model.params.map((p): ModelVar => ({
        name: p.id,
        type: p.modelica ?? p.type,
        variability: "parameter",
        causality: "",
        visibility: p.private ? "protected" : "public",
        value: String(p.default),
      })),
    [model.vars, model.params],
  );
  const shownVars = useMemo(
    () =>
      vars.filter((v) => {
        if (!needle) return true;
        const p = params.get(v.name);
        return `${v.name} ${v.type} ${kindOf(v)} ${v.comment ?? ""} ${p ? String(p.default) : ""}`.toLowerCase().includes(needle);
      }),
    [vars, params, needle],
  );
  const shownComponents = useMemo(
    () =>
      model.components.filter((c) => {
        if (!needle) return true;
        const values = Object.entries({ ...c.defaults, ...c.params })
          .map(([k, v]) => `${k} ${v}`)
          .join(" ");
        return `${c.name} ${c.class} ${values}`.toLowerCase().includes(needle);
      }),
    [model.components, needle],
  );
  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="var-tree" aria-label="Variables">
      <div className="var-tree-head">
        <input className="var-filter well" type="search" placeholder="Filter variables…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Filter variables" />
        {mode === "edit" && (
          <button
            type="button"
            className="key small"
            onClick={() => {
              const taken = new Set([...model.params.map((p) => p.id), ...model.components.map((c) => c.name)]);
              let n = 1;
              while (taken.has(`var${n}`)) n++;
              void api.addVariable(`var${n}`, "0", false).catch((e: Error) => setError(e.message));
            }}
          >
            + variable
          </button>
        )}
      </div>
      <div className="var-tree-body" role="tree" aria-label="Model variables">
        <button type="button" className="var-group" aria-expanded={!collapsed.has("model")} onClick={() => toggle("model")}>
          <span className="caret">{collapsed.has("model") ? "▸" : "▾"}</span>
          model variables
          <span className="lbl">{shownVars.length}</span>
        </button>
        {!collapsed.has("model") &&
          (shownVars.length ? (
            shownVars.map((v) => <VarRow key={v.name} v={v} param={params.get(v.name)} mode={mode} onError={setError} />)
          ) : (
            <p className="var-empty">{vars.length ? "No variables match." : "No top-level variables."}</p>
          ))}

        <button type="button" className="var-group" aria-expanded={!collapsed.has("components")} onClick={() => toggle("components")}>
          <span className="caret">{collapsed.has("components") ? "▸" : "▾"}</span>
          components
          <span className="lbl">{shownComponents.length}</span>
        </button>
        {!collapsed.has("components") && <p className="var-empty">{mode === "passthrough" ? "Nested variables stay inside the model." : "Component variables; edit a parameter on the canvas."}</p>}
        {!collapsed.has("components") &&
          (shownComponents.length ? (
            shownComponents.map((c) => (
              <div className="var-component" key={c.name}>
                <button type="button" className="var-component-head" aria-expanded={!collapsed.has(c.name)} onClick={() => toggle(c.name)}>
                  <span className="caret">{collapsed.has(c.name) ? "▸" : "▾"}</span>
                  {c.name}
                  <span className="var-type">{shortName(c.class)}</span>
                </button>
                {!collapsed.has(c.name) && <ComponentRows component={c} mode={mode} />}
              </div>
            ))
          ) : (
            <p className="var-empty">No components match.</p>
          ))}
      </div>
      {error && <p className="studio-var-error" role="alert">{error}</p>}
    </section>
  );
}
