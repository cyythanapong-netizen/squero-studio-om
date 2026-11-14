// A read-only code view (the flat model, the generated C++): the shared Studio editor, so it
// follows the user's editor theme and font, with Modelica or C++ highlighting.
import { StreamLanguage } from "@codemirror/language";
import { cpp } from "@codemirror/legacy-modes/mode/clike";
import { CodeEditor, type EditorSettings } from "@paperboat/shared/editor";
import { modelica } from "./modelica.ts";

const LANGUAGES = { mo: modelica, cpp: StreamLanguage.define(cpp) };

export function CodeView({ code, lang, ariaLabel, settings, appTheme }: {
  code: string;
  lang: "mo" | "cpp";
  ariaLabel: string;
  settings: EditorSettings;
  appTheme: "light" | "dark";
}) {
  return (
    <div className="code-view" role="region" aria-label={ariaLabel}>
      {/* The editor owns its text after mount: a new text is a new view. */}
      <CodeEditor key={code} value={code} settings={settings} appTheme={appTheme} ariaLabel={ariaLabel} language={LANGUAGES[lang]} readOnly />
    </div>
  );
}
