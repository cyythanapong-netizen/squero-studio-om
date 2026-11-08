// Simulate (contracts §8.2): a local check, not a second Flow page. Stop time, a Simulate key, the
// variables as chips to switch on and off, and the run as a uPlot plot. omc runs it; nothing
// leaves Studio and no block, board or backend is involved.

import { useEffect, useRef, useState } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { NumberField } from "@paperboat/shared/components";
import type { StudioModel } from "../model/types.ts";
import type { Actions, Stimulus } from "../store/index.tsx";

type Run = Awaited<ReturnType<Actions["simulate"]>>;

/** The variables worth plotting first: not derivatives, fewest dots, a few of them. */
export function defaultPicks(names: string[], limit = 3): string[] {
  return [...names]
    .filter((n) => !n.startsWith("der("))
    .sort((a, b) => a.split(".").length - b.split(".").length || a.localeCompare(b))
    .slice(0, limit);
}

/** Why the model won't balance, in words: a top-level output wired to nothing has no equation. */
export function outputWarnings(model: StudioModel): string[] {
  return model.entries
    .filter((e) => e.kind === "output" && !e.target)
    .map((e) => `${e.name} isn't wired to anything: an output needs an equation, so the model is unbalanced. Wire it to a port or remove it.`);
}

const KINDS: Stimulus["kind"][] = ["constant", "step", "ramp", "sine"];
const K_LABEL: Record<Stimulus["kind"], string> = { constant: "value", step: "height", ramp: "slope", sine: "amp" };

/** One row per top-level input: what drives it in this local run (nothing is exported). */
function Stimuli({ inputs, value, onChange }: { inputs: string[]; value: Record<string, Stimulus>; onChange: (v: Record<string, Stimulus>) => void }) {
  if (!inputs.length) return null;
  return (
    <div className="stimuli" role="group" aria-label="Input stimuli">
      {inputs.map((name) => {
        const s = value[name] ?? { kind: "constant", k: 0 };
        const set = (patch: Partial<Stimulus>) => onChange({ ...value, [name]: { ...s, ...patch } });
        return (
          <div key={name} className="stimulus">
            <span className="lbl mono">{name}</span>
            <select className="well" aria-label={`Stimulus for ${name}`} value={s.kind} onChange={(e) => set({ kind: e.target.value as Stimulus["kind"] })}>
              {KINDS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
            <span className="lbl">{K_LABEL[s.kind]}</span>
            <NumberField className="well" aria-label={`${name} ${K_LABEL[s.kind]}`} value={s.k} onChange={(k) => set({ k })} />
            {(s.kind === "step" || s.kind === "ramp") && (
              <>
                <span className="lbl">at t</span>
                <NumberField className="well" aria-label={`${name} start time`} value={s.t0 ?? 0} onChange={(t0) => set({ t0 })} />
              </>
            )}
            {s.kind === "sine" && (
              <>
                <span className="lbl">Hz</span>
                <NumberField className="well" aria-label={`${name} frequency`} value={s.f ?? 1} onChange={(f) => set({ f })} />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";

function Plot({ run, picks, theme }: { run: Run; picks: string[]; theme: string }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    const grid = { stroke: token("--line"), width: 1 };
    const axis = { stroke: token("--text-muted"), grid, ticks: grid, font: `12px ${token("--font-mono")}` };
    const plot = new uPlot(
      {
        width: host.current.clientWidth || 400,
        height: 180,
        legend: { show: false },
        cursor: { drag: { x: true, y: false } },
        scales: { x: { time: false } },
        axes: [axis, axis],
        series: [{}, ...picks.map((name, i) => ({ label: name, stroke: token(`--trace-${(i % 8) + 1}`), width: 1.5, dash: i >= 4 ? [4, 3] : undefined }))],
      },
      [run.t, ...picks.map((n) => run.series[n] ?? [])] as uPlot.AlignedData,
      host.current,
    );
    const resize = new ResizeObserver(() => host.current && plot.setSize({ width: host.current.clientWidth, height: 180 }));
    resize.observe(host.current);
    return () => {
      resize.disconnect();
      plot.destroy();
    };
  }, [run, picks, theme]);
  return <div className="plot" ref={host} role="img" aria-label={`Plot of ${picks.join(", ")}`} />;
}

export function Simulate({ actions, model, theme }: { actions: Actions; model: StudioModel; theme: string }) {
  const [stop, setStop] = useState("1");
  const [stimuli, setStimuli] = useState<Record<string, Stimulus>>({});
  const inputs = model.entries.filter((e) => e.kind === "input").map((e) => e.name);
  const warnings = outputWarnings(model);
  const [run, setRun] = useState<Run | null>(null);
  const [picks, setPicks] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const go = async () => {
    const t = Number(stop);
    if (!(t > 0)) return setError("stop time must be above 0");
    setBusy(true);
    setError("");
    try {
      const result = await actions.simulate(t, Object.fromEntries(Object.entries(stimuli).filter(([n]) => inputs.includes(n))));
      setRun(result);
      setPicks((p) => (p.filter((n) => result.names.includes(n)).length ? p.filter((n) => result.names.includes(n)) : defaultPicks(result.names)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="simulate" aria-label="Simulate">
      <header>
        <label className="lbl" htmlFor="stop-time">Stop time (s)</label>
        <input id="stop-time" className="well" inputMode="decimal" value={stop} onChange={(e) => setStop(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void go()} />
        <button className="key run" disabled={busy} onClick={() => void go()}>
          {busy ? "simulating…" : "Simulate"}
        </button>
      </header>
      <Stimuli inputs={inputs} value={stimuli} onChange={setStimuli} />
      {warnings.map((w) => (
        <p key={w} className="warning" role="status">
          {w}
        </p>
      ))}
      {error && <p className="error" role="alert">{error}</p>}
      {run && (
        <>
          <Plot run={run} picks={picks} theme={theme} />
          <div className="vars" role="group" aria-label="Variables">
            {run.names.map((n) => (
              <button key={n} className={`chip-pick${picks.includes(n) ? " on" : ""}`} style={picks.includes(n) ? ({ "--trace": `var(--trace-${(picks.indexOf(n) % 8) + 1})` } as React.CSSProperties) : undefined} aria-pressed={picks.includes(n)} onClick={() => setPicks((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]))}>
                {n}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
