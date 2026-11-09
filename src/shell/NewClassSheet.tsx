// New Class: a bottom sheet over the shell, not a modal. The five kinds, the target package, an
// optional base class, and the skeleton the server will write. The sheet computes the file and
// asks the app to create it; the app opens it next.

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { StudioModel } from "../model/types.ts";
import type { Workspace } from "./workspace.ts";
import { KINDS, defaultWithin, fileFor, packageOptions, skeleton, type ClassKind, type NewClassSpec } from "./newClass.ts";

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function NewClassSheet({
  workspace,
  model,
  onClose,
  onCreate,
}: {
  workspace: Workspace | null;
  model: StudioModel;
  onClose: () => void;
  onCreate: (spec: NewClassSpec) => void | Promise<void>;
}) {
  const options = packageOptions(workspace);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ClassKind>("model");
  const [within, setWithin] = useState(() => (options.some((o) => o.value === defaultWithin(model)) ? defaultWithin(model) : ""));
  const [base, setBase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const trimmed = name.trim();
  const valid = IDENTIFIER.test(trimmed);
  const file = fileFor(workspace, within, trimmed || "NewClass");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    try {
      await onCreate({ file, name: trimmed, kind, within, base: base.trim() || undefined });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="new-class-overlay" role="presentation" onClick={() => !busy && onClose()}>
      <section className="new-class-sheet" role="dialog" aria-modal="true" aria-label="New class" onClick={(e) => e.stopPropagation()}>
        <header className="new-class-head">
          <h2>New Class</h2>
          <span className="sub">{within || "workspace root"}</span>
          <span className="spacer" />
          <button type="button" className="key small" onClick={onClose} disabled={busy}>
            Close
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="new-class-body">
            <div>
              <div className="new-class-field">
                <label htmlFor="new-class-name">name</label>
                <input id="new-class-name" ref={input} value={name} placeholder="ExpansionValve" onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="new-class-field">
                <label>kind</label>
                <div className="new-class-kinds">
                  {KINDS.map((entry) => (
                    <button key={entry.kind} type="button" className={`new-class-kind${kind === entry.kind ? " on" : ""}`} aria-pressed={kind === entry.kind} onClick={() => setKind(entry.kind)}>
                      <b>{entry.label}</b>
                      <span>{entry.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="new-class-field">
                <label htmlFor="new-class-package">package</label>
                <select id="new-class-package" value={within} onChange={(e) => setWithin(e.target.value)}>
                  {options.map((option) => (
                    <option key={option.value || "root"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="new-class-field">
                <label htmlFor="new-class-base">base class (optional)</label>
                <input id="new-class-base" value={base} placeholder="Chiller.Interfaces.PartialTwoPort" onChange={(e) => setBase(e.target.value)} />
              </div>
              <div className="new-class-field" style={{ marginBottom: 0 }}>
                <label>file</label>
                <span className="new-class-file" title={file}>
                  {file}
                </span>
              </div>
              {error && (
                <p className="new-class-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <div>
              <div className="new-class-field" style={{ marginBottom: 0 }}>
                <label>skeleton</label>
                <pre className="new-class-skeleton">{skeleton(kind, trimmed || "NewClass", within, base.trim())}</pre>
              </div>
            </div>
          </div>
          <footer className="new-class-foot">
            <span className="note">the workspace stays visible behind it</span>
            <span className="spacer" />
            <button type="button" className="key small" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="key small ink" disabled={!valid || busy}>
              {busy ? "Creating…" : "Create class"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
