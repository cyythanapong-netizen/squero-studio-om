// The Console: every notice and error Studio raised, newest last. Replaces the footer toast.
import { useEffect, useRef } from "react";

export type Log = { level: "info" | "error"; text: string };

export function Console({ logs, onClose }: { logs: Log[]; onClose: () => void }) {
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [logs.length]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const errors = logs.filter((l) => l.level === "error").length;
  return (
    <section className="console-window" role="dialog" aria-label="Console">
      <header className="console-head">
        <h2>Console</h2>
        <span className="lbl">{`${logs.length} ${logs.length === 1 ? "line" : "lines"}${errors ? ` · ${errors} ${errors === 1 ? "error" : "errors"}` : ""}`}</span>
        {logs.length > 0 && (
          <button className="key small" title="Copy every line" onClick={() => void navigator.clipboard?.writeText(logs.map((l) => `[${l.level}] ${l.text}`).join("\n"))}>
            Copy all
          </button>
        )}
        <button className="key small" title="Close the Console (Esc)" onClick={onClose}>
          Close
        </button>
      </header>
      <ol ref={list} className="console-logs">
        {logs.length === 0 ? <li>Console ready.</li> : logs.map((l, i) => <li key={i} className={`log-${l.level}`}>{l.text}</li>)}
      </ol>
    </section>
  );
}
