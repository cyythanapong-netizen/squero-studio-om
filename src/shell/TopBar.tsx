// The top bar: squero [om], the menus and the model title on the left; on the right the shared
// BarEnd (@paperboat/shared, the same as Paperboat's and MX's): Console, the side pane's focus
// switch and toggle, the OMC status pill and the theme cycle.
// The source view and Export live in the side pane, the footer and the menus.

import type { ReactNode } from "react";
import { BarEnd, MenuBar, ProjectLabel, StatusPill, type Theme } from "@paperboat/shared/components";
import type { Command } from "@paperboat/shared";
import { chip, type OmcState, type OmcStatus } from "../omc/omc.ts";
import { SqueroWordmark } from "@paperboat/shared/squero";

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
  running?: boolean;
  /** The side pane's focus switch (code, split, scopes), shown while the pane is. */
  focus?: ReactNode;
  errors?: number;
  consoleShown?: boolean;
  onConsole?: () => void;
  aboutShown?: boolean;
  onAbout?: () => void;
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
  running = false,
  focus,
  errors = 0,
  consoleShown = false,
  onConsole,
  aboutShown = false,
  onAbout,
}: TopBarProps) {
  return (
    <header className="bar">
      <SqueroWordmark product="OM" name="OpenModelica" running={running} />
      <div className="menubar-group" data-own-keys>
        <MenuBar commands={commands} />
        <button
          type="button"
          className="menu-title"
          aria-expanded={aboutShown}
          title="About Squero Studio"
          onClick={onAbout}
        >
          About
        </button>
      </div>
      {model && <ProjectLabel name={model} dirty={dirty} />}
      <BarEnd
        keys={
          <button type="button" className={`key small${errors ? " err" : ""}${consoleShown ? " on" : ""}`} aria-pressed={consoleShown} title="Open the Console" onClick={onConsole}>
            {errors ? `${errors} ${errors === 1 ? "error" : "errors"}` : "Console"}
          </button>
        }
        panel={{ open: side, label: "Source & Simulate pane", onToggle: onToggleSide, view: focus }}
        status={
          <StatusPill
            label={chip(status)}
            labels={STATES.map((state) => chip({ ...status, state }))}
            tone={TONE[status.state]}
            title="OpenModelica: status and libraries"
            onClick={onStatusClick}
          />
        }
        theme={theme}
        onTheme={onTheme}
      />
    </header>
  );
}
