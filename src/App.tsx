// Squero Studio: OpenModelica. Provides StudioContext and mounts Lane B's slots exactly as their
// stubs declare: the popover on a component click, the sheet on Alt+V, the dock always.

import { ReactFlowProvider } from "@xyflow/react";
import { Switch } from "@paperboat/shared/components";
import { useShortcuts, type Command } from "@paperboat/shared";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Canvas } from "./canvas/Canvas.tsx";
import { runBackendExport } from "./dock/dock.ts";
import { StudioDock } from "./dock/index.tsx";
import { Library, useClassIndex } from "./library/Library.tsx";
import { StudioContext } from "./model/types.ts";
import { OmcClient, type OmcStatus } from "./omc/omc.ts";
import { Console, type Log } from "./shell/Console.tsx";
import { ComponentPopover } from "./popover/index.tsx";
import { InterfaceSheet } from "./sheet/index.tsx";
import { LibraryModal, PromptModal, StatusModal } from "./shell/Dialogs.tsx";
import { TopBar } from "./shell/TopBar.tsx";
import { useTheme, type Theme } from "@paperboat/shared/components";
import { Simulate } from "./simulate/Simulate.tsx";
import { Split, type View } from "./split/Split.tsx";
import { freeSpot } from "./store/plans.ts";
import { useStudioStore } from "./store/index.tsx";

type Focus = "code" | "split" | "scopes";

function serverUrl(): string {
  const given = new URLSearchParams(location.search).get("server");
  if (given) return given;
  return location.port === "3048" || !location.host ? "ws://localhost:59201" : `ws://${location.host}`;
}

/** The theme pick, remembered; the shared hook applies it and resolves "auto". */
function useThemeChoice(): [Theme, (t: Theme) => void, "light" | "dark"] {
  const [theme, set] = useState<Theme>(() => (localStorage.getItem("studio-theme") as Theme | null) ?? "auto");
  useEffect(() => localStorage.setItem("studio-theme", theme), [theme]);
  return [theme, set, useTheme(theme)];
}

export function App() {
  const [status, setStatus] = useState<OmcStatus>({ state: "checking", version: "" });
  const [omc, setOmc] = useState<OmcClient | null>(null);
  useEffect(() => {
    const client = new OmcClient(serverUrl(), setStatus);
    setOmc(client);
    return () => client.close();
  }, []);
  return omc ? (
    <ReactFlowProvider>
      <Studio omc={omc} status={status} />
    </ReactFlowProvider>
  ) : null;
}

type PromptSpec = {
  title: string;
  label: string;
  value?: string;
  placeholder?: string;
  confirmLabel?: string;
  onConfirm: (val: string) => void | Promise<void>;
};

function Studio({ omc, status }: { omc: OmcClient; status: OmcStatus }) {
  const { api, actions, error } = useStudioStore(omc, status);
  const [popover, setPopover] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [side, setSide] = useState(true);
  const [running, setRunning] = useState(false);
  const [view, setView] = useState<View>("mo");
  const [focus, setFocus] = useState<Focus>("split");
  const [theme, setTheme, shown] = useThemeChoice();
  const [promptModal, setPromptModal] = useState<PromptSpec | null>(null);
  const [libraryModalOpen, setLibraryModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [logs, setLogs] = useState<Log[]>([]);
  const [consoleShown, setConsoleShown] = useState(false);
  const errors = logs.filter((l) => l.level === "error").length;
  const say = (text: string, level: Log["level"] = "info") => setLogs((l) => [...l, { level, text }]);
  const fail = (e: Error) => say(e.message, "error");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const classes = useClassIndex(omc);

  const model = api?.model;
  useEffect(() => {
    if (popover && model && !model.components.some((c) => c.name === popover)) setPopover(null);
  }, [popover, model]);

  useEffect(() => {
    if (actions.notice) say(actions.notice);
  }, [actions.notice]);

  const handleExportBackend = async () => {
    if (!api) return;
    const outcome = await runBackendExport(api, "ppk", () => {});
    if (outcome.ok) {
      say(`Exported ${outcome.line}`);
    } else {
      say(`Export failed: ${outcome.line}`, "error");
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const content = String(reader.result ?? "");
      try {
        await actions.openFile(file.name, content);
      } catch (err) {
        fail(err as Error);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const commands = useMemo<Command[]>(
    () => [
      // File menu (Issue #11)
      {
        id: "file.new",
        label: "New Model",
        menu: "file",
        group: "model",
        shortcut: "Ctrl+N",
        chord: { key: "n", ctrl: true },
        run: () =>
          setPromptModal({
            title: "New Model",
            label: "Model Name",
            value: "NewModel.mo",
            confirmLabel: "Create",
            onConfirm: (name) => actions.newModel(name).catch(fail),
          }),
      },
      {
        id: "file.open",
        label: "Open / Import .mo…",
        menu: "file",
        group: "model",
        shortcut: "Ctrl+O",
        chord: { key: "o", ctrl: true },
        run: () => fileInputRef.current?.click(),
      },
      {
        id: "file.open-path",
        label: "Open from Path…",
        menu: "file",
        group: "model",
        run: () =>
          setPromptModal({
            title: "Open Modelica File",
            label: "File Path",
            placeholder: "e.g. models/MyModel.mo",
            confirmLabel: "Open",
            onConfirm: (path) => actions.openFile(path).catch(fail),
          }),
      },
      {
        id: "file.save",
        label: "Save",
        menu: "file",
        group: "save",
        shortcut: "Ctrl+S",
        chord: { key: "s", ctrl: true },
        enabled: Boolean(model),
        run: () => void actions.save().catch(fail),
      },
      {
        id: "file.save-as",
        label: "Save As…",
        menu: "file",
        group: "save",
        shortcut: "Ctrl+Shift+S",
        chord: { key: "s", ctrl: true, shift: true },
        enabled: Boolean(model),
        run: () =>
          setPromptModal({
            title: "Save Model As",
            label: "File Path",
            value: model?.file ?? `${model?.name}.mo`,
            confirmLabel: "Save",
            onConfirm: (path) => actions.saveAs(path).catch(fail),
          }),
      },
      {
        id: "file.load-library",
        label: "Load Modelica Library…",
        menu: "file",
        group: "library",
        run: () => setLibraryModalOpen(true),
      },
      {
        id: "file.export",
        label: "Export Paperboat Backend (.ppk)",
        menu: "file",
        group: "export",
        shortcut: "Ctrl+E",
        chord: { key: "e", ctrl: true },
        run: () => void handleExportBackend(),
      },

      // Edit menu
      { id: "undo", label: "Undo", menu: "edit", group: "history", shortcut: "Ctrl+Z", enabled: actions.canUndo, run: actions.undo },
      { id: "redo", label: "Redo", menu: "edit", group: "history", shortcut: "Ctrl+Shift+Z", enabled: actions.canRedo, run: actions.redo },

      // View menu
      { id: "side", label: "Source and Simulate", menu: "view", group: "panes", checked: side, run: () => setSide((s) => !s) },
      { id: "mo", label: ".mo", menu: "view", group: "source", checked: view === "mo", run: () => (setView("mo"), setSide(true)) },
      { id: "cpp", label: "causal ODE c++", menu: "view", group: "source", checked: view === "cpp", run: () => (setView("cpp"), setSide(true)) },
      ...(["code", "split", "scopes"] as Focus[]).map((f): Command => ({ id: `focus-${f}`, label: f === "split" ? "Code and scopes" : f === "code" ? "Focus code" : "Focus scopes", menu: "view", group: "focus", checked: focus === f, run: () => (setFocus(f), setSide(true)) })),
      { id: "console", label: "Console", menu: "view", group: "sheet", checked: consoleShown, run: () => setConsoleShown((c) => !c) },
      { id: "sheet", label: "Interface sheet", menu: "view", group: "sheet", shortcut: "Alt+V", chord: { key: "v", alt: true }, run: () => setSheet((s) => !s) },
      ...(["auto", "light", "dark"] as Theme[]).map((t): Command => ({ id: `theme-${t}`, label: t, menu: "view", group: "theme", checked: theme === t, run: () => setTheme(t) })),
    ],
    [actions.canUndo, actions.canRedo, actions.undo, actions.redo, actions.newModel, actions.openFile, actions.save, actions.saveAs, side, view, focus, theme, setTheme, model, api, consoleShown],
  );
  useShortcuts(commands);

  return (
    <StudioContext.Provider value={api}>
      <div className={`studio${side ? " with-side" : ""}`}>
        <TopBar
          status={status}
          model={model?.name}
          dirty={actions.dirty}
          commands={commands}
          side={side}
          onToggleSide={() => setSide((s) => !s)}
          errors={errors}
          consoleShown={consoleShown}
          onConsole={() => setConsoleShown((c) => !c)}
          theme={theme}
          onTheme={setTheme}
          onStatusClick={() => setStatusModalOpen(true)}
          running={running}
        />
        {api && model ? (
          <>
            <Library omc={omc} model={model.name} onPlace={(cls) => void actions.place(cls, freeSpot(model)).then((name) => api.select([name]))} />
            <Canvas api={api} actions={actions} classes={classes} onOpen={setPopover} />
            {side && (
              <aside className={`side focus-${focus}`}>
                <div className="side-focus">
                  <Switch<Focus>
                    label="Focus"
                    value={focus}
                    onChange={setFocus}
                    options={[
                      { value: "code", label: "code", hint: "The source fills the pane" },
                      { value: "split", label: "split", hint: "Source above, scopes below" },
                      { value: "scopes", label: "scopes", hint: "The scopes fill the pane" },
                    ]}
                  />
                </div>
                <Split model={model} actions={actions} view={view} onView={setView} />
                <Simulate actions={actions} model={model} theme={shown} onRunningChange={setRunning} />
              </aside>
            )}
            {popover && <ComponentPopover component={popover} onClose={() => setPopover(null)} />}
            <InterfaceSheet open={sheet} onOpen={() => setSheet(true)} onClose={() => setSheet(false)} />
            <div className="dock-slot">
              <StudioDock />
            </div>
          </>
        ) : (
          <p className="opening" role="status">
            {error || (status.state === "failed" ? "No Studio server: start one with squero-om" : "opening the model…")}
          </p>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".mo,.moe"
          style={{ display: "none" }}
          onChange={handleFileInputChange}
        />

        {promptModal && (
          <PromptModal
            title={promptModal.title}
            label={promptModal.label}
            value={promptModal.value}
            placeholder={promptModal.placeholder}
            confirmLabel={promptModal.confirmLabel}
            onConfirm={promptModal.onConfirm}
            onClose={() => setPromptModal(null)}
          />
        )}

        {libraryModalOpen && (
          <LibraryModal
            onLoad={(lib) => actions.loadLibrary(lib).catch(fail)}
            onClose={() => setLibraryModalOpen(false)}
          />
        )}

        {statusModalOpen && (
          <StatusModal
            status={status}
            serverUrl={serverUrl()}
            onClose={() => setStatusModalOpen(false)}
          />
        )}

        {consoleShown && <Console logs={logs} onClose={() => setConsoleShown(false)} />}
      </div>
    </StudioContext.Provider>
  );
}
