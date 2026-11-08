// The top bar: squero studio [ Om ] on the left, the menus, model title with dirty indicator,
// and on the right: View toggles (Source & Simulate, Code split), Export action, OMC status chip, Theme switch.

import { MenuBar, Switch } from "@paperboat/shared/components";
import type { Command } from "@paperboat/shared";
import { chip, type OmcStatus } from "../omc/omc.ts";
import type { View } from "../split/Split.tsx";

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
  view: View;
  onView: (v: View) => void;
  side: boolean;
  onToggleSide: () => void;
  theme: Theme;
  onTheme: (t: Theme) => void;
  onExport?: () => void;
  onStatusClick?: () => void;
};

export function TopBar({
  status,
  model,
  dirty = false,
  commands,
  view,
  onView,
  side,
  onToggleSide,
  theme,
  onTheme,
  onExport,
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
        className={`key small${side ? " on" : ""}`}
        aria-pressed={side}
        title="Toggle Source & Simulate pane"
        onClick={onToggleSide}
      >
        Source & Simulate
      </button>
      <Switch
        label="View"
        value={view}
        onChange={onView}
        options={[
          { value: "mo", label: ".mo", hint: "Modelica source (.mo)" },
          { value: "cpp", label: "ODE c++", hint: "Generated ODE C++ backend preview" },
        ]}
      />
      {onExport && (
        <button
          type="button"
          className="key small run"
          title="Export Paperboat backend (Ctrl+E)"
          onClick={onExport}
        >
          Export backend
        </button>
      )}
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
      <Switch
        label="Theme"
        value={theme}
        onChange={onTheme}
        options={[
          { value: "auto", label: "Auto" },
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ]}
      />
    </header>
  );
}
