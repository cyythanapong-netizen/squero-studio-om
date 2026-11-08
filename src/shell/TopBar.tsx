// The top bar: squero studio [ Om ], the menus and the model title on the left; on the right
// only three quiet controls: the side-pane toggle, the OMC status chip and a theme cycle.
// The source view and Export live in the side pane, the footer and the menus.

import { MenuBar } from "@paperboat/shared/components";
import type { Command } from "@paperboat/shared";
import type { JSX } from "react";
import { chip, type OmcStatus } from "../omc/omc.ts";

export type Theme = "auto" | "light" | "dark";

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

const NEXT: Record<Theme, Theme> = { auto: "light", light: "dark", dark: "auto" };
const GLYPH: Record<Theme, JSX.Element> = {
  auto: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 2.5a5.5 5.5 0 0 1 0 11z" className="fill" />
    </>
  ),
  light: (
    <>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3" />
    </>
  ),
  dark: <path d="M13 9.5A5.5 5.5 0 1 1 6.5 3a4.5 4.5 0 0 0 6.5 6.5z" />,
};

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
      <button
        type="button"
        className={`chip omc-${status.state}`}
        role="status"
        title="OMC runtime status (click for diagnostics)"
        onClick={onStatusClick}
      >
        <i aria-hidden="true" />
        {chip(status)}
      </button>
      <button
        type="button"
        className="key small icon-key"
        aria-label={`Theme: ${theme}`}
        title={`Theme: ${theme} (click for ${NEXT[theme]})`}
        onClick={() => onTheme(NEXT[theme])}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">{GLYPH[theme]}</svg>
      </button>
    </header>
  );
}
