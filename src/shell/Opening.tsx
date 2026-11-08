// The wait screen: says what Studio is really waiting for, in order: the OpenModelica runtime
// starting, then the Modelica library loading with the model, then reading the model.
import { useEffect, useState } from "react";
import type { OmcStatus } from "../omc/omc.ts";

export function Opening({ status, stage, error }: { status: OmcStatus; stage: string; error: string }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const failed = !!error || status.state === "failed";
  const words = error || (status.state === "failed" ? "No Studio server: start one with squero-om" : status.state === "checking" ? "starting the OpenModelica runtime" : stage);
  return (
    <div className="opening" role="status">
      <p>{failed ? words : `${words}…${seconds >= 3 ? ` ${seconds}s` : ""}`}</p>
      {!failed && (
        <span className="wave" aria-hidden="true">
          <i /><i /><i /><i /><i />
        </span>
      )}
      {!failed && seconds >= 6 && (
        <p className="hint">
          {status.state === "checking"
            ? "OpenModelica starts a fresh process: this is the slow part of a cold start."
            : "The first open loads the whole Modelica Standard Library, which takes a few seconds."}
        </p>
      )}
    </div>
  );
}
