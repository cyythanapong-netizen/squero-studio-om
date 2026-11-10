import { useEffect, useRef, useState } from "react";
import type { OmcClient, OmcStatus } from "../omc/omc.ts";
import { STUDIO_VERSION } from "../version.ts";
import { SqueroLogo } from "./SqueroLogo.tsx";

const CREATOR = { name: "Thanapong Chuangyanyong", href: "https://github.com/thanapong-chuangyanyong" };

/**
 * About Squero Studio: the W3 Water mark (its five dots rippling continuously, as on the bar),
 * the Studio, Paperboat and OpenModelica versions, the license and the creator. The server's
 * `about` op runs `paperboat --version`, so Paperboat is "Not installed" when it isn't there.
 */
export function AboutModal({ omc, status, onClose }: { omc: OmcClient; status: OmcStatus; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  // undefined: still asking the server; null: paperboat isn't installed.
  const [paperboat, setPaperboat] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    close.current?.focus();
    let live = true;
    omc.op<{ paperboat?: string | null }>("about").then(
      (reply) => live && setPaperboat(reply.paperboat ?? null),
      () => live && setPaperboat(null),
    );
    return () => {
      live = false;
    };
  }, [omc]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const omcVersion = /\d+\.\d+\.\d+/.exec(status.version)?.[0] ?? "";
  const paperboatText = paperboat === undefined ? "checking…" : paperboat ?? "Not installed";

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="About Squero Studio" data-own-keys>
      <div className="modal-dialog about-dialog" onClick={(event) => event.stopPropagation()}>
        <header className="modal-head">
          <h3>About Squero Studio</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="about-body">
          <div className="about-mark">
            <SqueroLogo product="OM" height={34} running />
            <span className="lbl">OpenModelica</span>
          </div>
          <div className="about-info">
            <dl className="about-facts">
              <dt>Version</dt>
              <dd className="mono">{STUDIO_VERSION}</dd>
              <dt>Paperboat</dt>
              <dd className="mono">{paperboatText}</dd>
              <dt>OpenModelica</dt>
              <dd className="mono">{omcVersion || (status.state === "failed" ? "Not running" : "checking…")}</dd>
              <dt>License</dt>
              <dd>All rights reserved</dd>
            </dl>
            <section className="about-section">
              <h3>Credits</h3>
              <p>
                Built on{" "}
                <a href="https://openmodelica.org" target="_blank" rel="noreferrer">
                  OpenModelica
                </a>
                {omcVersion ? ` ${omcVersion}` : ""}.
              </p>
              <p>
                Created by{" "}
                <a href={CREATOR.href} target="_blank" rel="noreferrer">
                  {CREATOR.name}
                </a>
                .
              </p>
              <p className="lbl">A PaperboatLab project.</p>
            </section>
          </div>
        </div>
        <footer className="modal-actions">
          <button ref={close} type="button" className="key small" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
