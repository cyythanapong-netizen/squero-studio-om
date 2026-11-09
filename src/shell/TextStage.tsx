// The stage's Text view: the model's whole .mo, editable. It reads the file (not omc's list(),
// which is the class body) so `within` and annotations are exactly what Save writes back.
// A read view keeps syntax highlighting; edit is a plain code buffer with line selection from a
// message. The App routes Save and document switches through the registered handle.

import { useCallback, useEffect, useRef, useState } from "react";
import { Switch } from "@paperboat/shared/components";
import type { StudioModel } from "../model/types.ts";
import { CodeView } from "../split/CodeView.tsx";
import type { Actions } from "../store/index.tsx";

export type TextEditorHandle = { dirty: boolean; save: () => Promise<void> };

export function TextStage({
  model,
  actions,
  line,
  onEditor,
}: {
  model: StudioModel;
  actions: Actions;
  line?: number;
  onEditor?: (handle: TextEditorHandle | null) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const [saved, setSaved] = useState("");
  const [editing, setEditing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  const read = useRef(actions.fileText);
  read.current = actions.fileText;
  const write = useRef(actions.saveText);
  write.current = actions.saveText;
  const editorCb = useRef(onEditor);
  editorCb.current = onEditor;

  useEffect(() => {
    let live = true;
    setText(null);
    setError("");
    read.current().then(
      (value) => {
        if (!live) return;
        setText(value);
        setSaved(value);
      },
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [model.file]);

  const dirty = text !== null && text !== saved;
  const save = useCallback(async () => {
    if (text === null || text === saved || busy) return;
    setBusy(true);
    setError("");
    try {
      await write.current(text);
      setSaved(text);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [text, saved, busy]);
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    editorCb.current?.({ dirty, save: () => saveRef.current() });
  }, [dirty]);
  useEffect(
    () => () => {
      editorCb.current?.(null);
    },
    [],
  );

  // Ctrl+S saves the buffer, not the stale omc model: capture it before the app's shortcut.
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        e.stopPropagation();
        void saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [editing]);

  useEffect(() => {
    const el = area.current;
    if (!editing || !line || !el || text === null) return;
    const rows = text.split("\n");
    const at = Math.min(Math.max(line - 1, 0), rows.length - 1);
    const start = rows.slice(0, at).reduce((n, row) => n + row.length + 1, 0);
    el.focus();
    el.setSelectionRange(start, start + rows[at].length);
    const lh = Number.parseFloat(getComputedStyle(el).lineHeight) || 18;
    el.scrollTop = Math.max(0, at * lh - el.clientHeight / 2);
  }, [line, editing, text]);

  const name = model.file ? model.file.split(/[\\/]/).pop() : `${model.name}.mo`;
  return (
    <section className="stage-text" aria-label={`${model.name} text`}>
      <header className="code-head">
        <b>{name}</b>
        <span className="lbl">· {model.name}</span>
        <Switch<"read" | "edit">
          label=""
          value={editing ? "edit" : "read"}
          onChange={(choice) => setEditing(choice === "edit")}
          options={[
            { value: "read", label: "read" },
            { value: "edit", label: "edit" },
          ]}
        />
        <span className="spacer" />
        {dirty && <span className="lbl">unsaved</span>}
        {text !== null && (
          <button type="button" className="key small" onClick={() => void navigator.clipboard?.writeText(text)}>
            Copy
          </button>
        )}
        <button type="button" className="key small ink" disabled={!dirty || busy} onClick={() => void save()}>
          {busy ? "saving…" : "Save"}
        </button>
      </header>
      {editing ? (
        <textarea
          ref={area}
          className="code-editor"
          aria-label="Modelica source editor"
          value={text ?? ""}
          placeholder={text === null ? "reading…" : ""}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(e) => setText(e.target.value)}
        />
      ) : (
        <CodeView code={text ?? (error || "reading…")} lang="mo" ariaLabel="Modelica source" line={line} />
      )}
      {error && (
        <p className="studio-var-error code-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
