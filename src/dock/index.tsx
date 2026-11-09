import { useEffect, useRef, useState } from "react";
import { useStudio, type ExportMode, type ExportProgress } from "../model/types.ts";
import {
  checkModelBalance,
  findDanglingFlowPorts,
  fixDanglingPort,
  runBackendExport,
  undrawnNote,
  type BalanceResult,
  type DanglingPort,
  type ExportOutcome,
} from "./dock.ts";
import "./dock.css";

export function StudioDock() {
  const api = useStudio();
  const [balance, setBalance] = useState<BalanceResult>({
    kind: "balanced",
    equations: 0,
    unknowns: 0,
    ratio: "… / …",
    words: "checking balance…",
  });
  const [running, setRunning] = useState<{ port: number; up: boolean; ready?: boolean; line?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [outcome, setOutcome] = useState<ExportOutcome | null>(null);
  const [fixError, setFixError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const modelSignature = JSON.stringify({
    name: api.model.name,
    components: api.model.components,
    connections: api.model.connections,
    params: api.model.params,
    entries: api.model.entries,
    revision,
  });

  // Keyed on the model and omc only: api itself is rebuilt on every status push, and
  // checkModel causes one, so depending on api re-checks forever.
  const omc = api.omc;
  const modelName = api.model.name;
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void checkModelBalance({ omc, model: { name: modelName } }).then((res) => {
        if (!cancelled) setBalance(res);
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [omc, modelName, modelSignature]);

  const dangling = findDanglingFlowPorts(api.model);
  const undrawn = undrawnNote(api.model.undrawn);
  const isBalanced = balance.kind === "balanced";

  const handleFix = async (item: DanglingPort) => {
    setFixError(null);
    const err = await fixDanglingPort(api, item);
    if (err) setFixError(err);
    setRevision((r) => r + 1);
  };

  const handleExport = async (mode: ExportMode) => {
    if (!isBalanced || busy) return;
    setBusy(true);
    setOutcome(null);
    const again = mode === "serve" ? running?.port : undefined; // a restart keeps its port
    if (again) await runBackendExport(api, "stop", () => {}, again);
    setRunning(null);
    setProgress({ stage: "check", fraction: 0 });
    const res = await runBackendExport(api, mode, (p) => {
      setProgress({ ...p });
    }, again);
    setProgress(null);
    if (!(mode === "serve" && res.ok)) setOutcome(res); // a started backend reports below as it comes up
    if (mode === "serve" && res.ok && res.result.port) setRunning({ port: res.result.port, up: false });
    setBusy(false);
  };

  // A started backend builds first (minutes, cold): poll until it listens or exits.
  const pollPort = running && !running.up ? running.port : null;
  const apiRef = useRef(api);
  apiRef.current = api; // api is rebuilt on every status push: keep the timer off it
  useEffect(() => {
    if (!pollPort) return;
    const timer = setInterval(() => {
      void runBackendExport(apiRef.current, "status", () => {}, pollPort).then((res) => {
        if (res.ok && res.result.state === "building") {
          const line = (res.result.log ?? "").trim().split("\n").pop();
          return setRunning((r) => (r && r.port === pollPort ? { ...r, line } : r));
        }
        if (!res.ok) setOutcome(res); // it exited: the log says why
        setRunning(res.ok ? { port: pollPort, up: true } : null);
      });
    }, 1500);
    return () => clearInterval(timer);
  }, [pollPort]);

  // Listening is not ready: wait for the backend's own hello over its WebSocket.
  const probePort = running?.up && !running.ready ? running.port : null;
  useEffect(() => {
    if (!probePort) return;
    let ws: WebSocket | undefined;
    let timer: ReturnType<typeof setTimeout>;
    let done = false;
    const tryOnce = () => {
      ws = new WebSocket(`ws://localhost:${probePort}`);
      ws.onmessage = () => {
        done = true;
        ws?.close();
        setRunning((r) => (r && r.port === probePort ? { ...r, ready: true } : r));
      };
      ws.onclose = () => {
        if (!done) timer = setTimeout(tryOnce, 1000);
      };
    };
    tryOnce();
    return () => {
      done = true;
      clearTimeout(timer);
      ws?.close();
    };
  }, [probePort]);
  const backendWords = !running
    ? null
    : !running.up
      ? `building for :${running.port}${running.line ? `: ${running.line.slice(0, 90)}` : "…"}`
      : !running.ready
        ? `started on :${running.port}, waiting for it to answer…`
        : `ready: connect Paperboat to ws://localhost:${running.port}`;

  const handleStop = async () => {
    if (!running || busy) return;
    setBusy(true);
    const res = await runBackendExport(api, "stop", () => {}, running.port);
    setOutcome(res);
    if (res.ok) setRunning(null);
    setBusy(false);
  };

  return (
    <div className="studio-dock" role="region" aria-label="Model balance and export" data-own-keys>
      {progress && (
        <div className="studio-dock-progress-track" aria-hidden="true">
          <div
            className="studio-dock-progress-bar"
            style={{ width: `${Math.max(0, Math.min(100, Math.round(progress.fraction * 100)))}%` }}
          />
        </div>
      )}

      <div className="studio-dock-row">
        <output
          className={`studio-dock-balance${isBalanced ? "" : " unbalanced"}`}
          aria-label="Equation and unknown balance"
        >
          <span className="studio-dock-dot" aria-hidden="true" />
          <span title={balance.words}>{balance.words}</span>
        </output>

        {undrawn && (
          <output
            className="studio-dock-undrawn"
            aria-label="Constructs not drawn as declared"
            title={undrawn.title}
          >
            {undrawn.label}
          </output>
        )}

        {dangling.length > 0 && (
          <div className="studio-dock-dangling" aria-label="Dangling flow connectors">
            {dangling.map((item) => (
              <span key={item.portPath} className="studio-dock-dangling-item">
                <span>{item.label}</span>
                {item.fix && (
                  <button
                    type="button"
                    className="studio-dock-fix-key"
                    onClick={() => void handleFix(item)}
                  >
                    [ {item.fix.buttonLabel} ]
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        <div className="studio-dock-export">
          <button
            type="button"
            className="studio-dock-export-key"
            disabled={!isBalanced || busy}
            title={isBalanced ? "Download the backend as a .ppk package" : balance.words}
            onClick={() => void handleExport("ppk")}
          >
            Download .ppk
          </button>
          <button
            type="button"
            className="studio-dock-export-key"
            disabled={!isBalanced || busy}
            title={isBalanced ? "Start the backend as ssom_<model> on a free port" : balance.words}
            onClick={() => void handleExport("serve")}
          >
            {running ? "Restart" : "Start"} backend
          </button>
          {running && (
            <button type="button" className="studio-dock-export-key" disabled={busy} onClick={() => void handleStop()}>
              Stop :{running.port}
            </button>
          )}
        </div>
      </div>

      {(progress || outcome || fixError || backendWords) && (
        <div className="studio-dock-row">
          {progress && <span className="studio-dock-stage">{progress.stage}</span>}
          {backendWords && !progress && <span className={`studio-dock-stage backend-${running?.ready ? "ready" : "wait"}`}>{backendWords}</span>}
          {outcome && (
            <span className={`studio-dock-result${outcome.ok ? "" : " error"}`}>
              {outcome.line}
            </span>
          )}
          {fixError && <span className="studio-dock-result error">{fixError}</span>}
        </div>
      )}
    </div>
  );
}
