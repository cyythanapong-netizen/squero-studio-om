// The stage's Text view: the model's .mo from omc's list(), with line numbers. Read-only for now;
// the editable buffer and the message gutter arrive with the authoring editing mode.

import { useEffect, useRef, useState } from "react";
import type { StudioModel } from "../model/types.ts";
import { CodeView } from "../split/CodeView.tsx";
import type { Actions } from "../store/index.tsx";

export function TextStage({
  model,
  actions,
  line,
}: {
  model: StudioModel;
  actions: Actions;
  line?: number;
}) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState("");
  const source = useRef(actions.source);
  source.current = actions.source;

  useEffect(() => {
    let live = true;
    setText(null);
    setError("");
    source.current().then(
      (value) => live && setText(value),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [model]);

  const name = model.file ? model.file.split(/[\\/]/).pop() : `${model.name}.mo`;
  return (
    <section className="stage-text" aria-label={`${model.name} text`}>
      <header className="code-head">
        <b>{name}</b>
        <span className="lbl">· read-only · omc&apos;s list({model.name})</span>
        <span className="spacer" />
        {text !== null && (
          <button type="button" className="key small" onClick={() => void navigator.clipboard?.writeText(text)}>
            Copy
          </button>
        )}
      </header>
      <CodeView code={text ?? (error || "reading…")} lang="mo" ariaLabel="Modelica source" line={line} />
    </section>
  );
}
