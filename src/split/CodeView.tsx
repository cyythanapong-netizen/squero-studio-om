import { useMemo } from "react";
import { tokenize } from "./highlight.ts";

export function CodeView({
  code,
  lang,
  ariaLabel,
}: {
  code: string;
  lang: "mo" | "cpp";
  ariaLabel: string;
}) {
  const lines = useMemo(() => tokenize(code, lang), [code, lang]);

  return (
    <div className="code-view" role="region" aria-label={ariaLabel}>
      <pre className="code-container">
        {lines.map((lineTokens, i) => (
          <div key={i} className="code-row">
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
