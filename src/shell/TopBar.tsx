// The top bar: squero studio [ Om ], the menus and the model title on the left; on the right
// only three quiet controls: the side-pane toggle, the OMC status pill and a theme cycle (both
// from @paperboat/shared, the same as Paperboat's top bar).
// The source view and Export live in the side pane, the footer and the menus.

import { MenuBar, StatusPill, ThemeToggle, type Theme } from "@paperboat/shared/components";
import type { Command } from "@paperboat/shared";
import { chip, type OmcState, type OmcStatus } from "../omc/omc.ts";

export function Wordmark() {
  return (
    <span className="wordmark" aria-label="Squero Studio: OpenModelica">
      <b>squero</b>
      <span className="studio-word">studio</span>
      <span className="om-badge">Om</span>
    </span>
  );
}

export function ProjectLabel({ name, dirty }: { name: string; dirty?: boolean }) {
  return (
    <span className="proj" title={dirty ? `${name}: unsaved changes (Ctrl+S saves)` : name}>
      <span className="proj-name">{name}</span>
      {dirty && <i className="dirty" role="img" aria-label="Unsaved changes" />}
    </span>
  );
}

export type TopBarProps = {
  status: OmcStatus;
  model?: string;
  dirty?: boolean;
  commands: Command[];
  side: boolean;
  onToggleSide: () => void;
  theme: Theme;
  onTheme: (t: Theme) => void;
  onStatusClick?: () => void;
};

const STATES: OmcState[] = ["checking", "ready", "failed"];
const TONE = { ready: "ok", checking: "busy", failed: "bad" } as const;

export function TopBar({
  status,
  model,
  dirty = false,
  commands,
  side,
  onToggleSide,
  theme,
  onTheme,
  onStatusClick,
}: TopBarProps) {
  return (
    <header className="bar">
      <Wordmark />
      <MenuBar commands={commands} />
      {model && <ProjectLabel name={model} dirty={dirty} />}
      <span className="spacer" />
      <button
        type="button"
        className={`key small icon-key${side ? " on" : ""}`}
        aria-pressed={side}
        aria-label="Source & Simulate pane"
        title="Source & Simulate pane"
        onClick={onToggleSide}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
          <path d="M10 2.5v11" />
          {side && <rect x="10" y="2.5" width="4.5" height="11" className="fill" />}
        </svg>
      </button>
      <StatusPill
        label={chip(status)}
        labels={STATES.map((state) => chip({ ...status, state }))}
        tone={TONE[status.state]}
        title="OMC runtime status (click for diagnostics)"
        onClick={onStatusClick}
      />
      <ThemeToggle theme={theme} onTheme={onTheme} />
    </header>
  );
}
