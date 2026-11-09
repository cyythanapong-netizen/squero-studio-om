// The strip above the stage: one tab per open .mo, the active one with its dirty dot and a close
// key, and a + that opens a file. Closing the last document is refused; the shell always has one.

import type { Doc } from "./workspace.ts";

export function DocTabs({
  docs,
  active,
  dirty,
  meta,
  onSelect,
  onClose,
  onOpen,
}: {
  docs: Doc[];
  active?: string;
  dirty?: boolean;
  meta?: string;
  onSelect: (doc: Doc) => void;
  onClose: (doc: Doc) => void;
  onOpen: () => void;
}) {
  return (
    <div className="docbar" aria-label="Open documents">
      {docs.map((doc) => {
        const here = doc.file === active;
        return (
          <div key={doc.file} className={`doc-tab${here ? " on" : ""}`}>
            <button type="button" className="doc-pick" aria-current={here ? "page" : undefined} title={doc.file} onClick={() => onSelect(doc)}>
              {doc.name}
            </button>
            {here && dirty && <i className="dirty" aria-label="Unsaved changes" />}
            <button type="button" className="x" aria-label={`Close ${doc.name}`} title={docs.length < 2 ? "The last document stays open" : `Close ${doc.name}`} disabled={docs.length < 2} onClick={() => onClose(doc)}>
              ×
            </button>
          </div>
        );
      })}
      <button type="button" className="doc-add" title="Open a .mo file" onClick={onOpen}>
        +
      </button>
      {meta && <span className="stage-meta">{meta}</span>}
    </div>
  );
}
