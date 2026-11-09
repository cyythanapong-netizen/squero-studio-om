import { useEffect, useMemo, useRef } from "react";
import { tokenize } from "./highlight.ts";

export function CodeView({
  code,
  lang,
  ariaLabel,
  line,
}: {
  code: string;
  lang: "mo" | "cpp";
  ariaLabel: string;
  /** A 1-based line to bring into view (a message's source). */
  line?: number;
}) {
  const lines = useMemo(() => tokenize(code, lang), [code, lang]);
  const hit = useRef<HTMLDivElement>(null);

  useEffect(() => {
    hit.current?.scrollIntoView({ block: "center" });
  }, [line, code]);

  return (
    <div className="code-view" role="region" aria-label={ariaLabel}>
      <pre className="code-container">
        {lines.map((lineTokens, i) => (
          <div key={i} className={`code-row${line === i + 1 ? " hit" : ""}`} ref={line === i + 1 ? hit : undefined}>
            <span className="code-ln" aria-hidden="true">
              {i + 1}
            </span>
            <span className="code-content">
              {lineTokens.map((t, j) =>
                t.type === "plain" ? (
                  t.text
                ) : (
                  <span key={j} className={`tok-${t.type}`}>
                    {t.text}
                  </span>
                ),
              )}
            </span>
          </div>
        ))}
      </pre>
    </div>
  );
}
