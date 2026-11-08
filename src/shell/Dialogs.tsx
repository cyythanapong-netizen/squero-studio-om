import { useEffect, useRef, useState, type FormEvent } from "react";
import type { OmcStatus } from "../omc/omc.ts";

export function PromptModal({
  title,
  label,
  value: initialValue = "",
  placeholder = "",
  confirmLabel = "OK",
  onConfirm,
  onClose,
}: {
  title: string;
  label: string;
  value?: string;
  placeholder?: string;
  confirmLabel?: string;
  onConfirm: (val: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const [val, setVal] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!val.trim()) return;
    void onConfirm(val.trim());
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <label>
              <span>{label}</span>
              <input
                ref={inputRef}
                value={val}
                placeholder={placeholder}
                onChange={(e) => setVal(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && onClose()}
              />
            </label>
          </div>
          <footer className="modal-actions">
            <button type="button" className="key small" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="key small run">
              {confirmLabel}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

const COMMON_LIBRARIES = [
  { name: "Modelica", desc: "Modelica Standard Library (MSL)" },
  { name: "Modelica_Synchronous", desc: "Synchronous control systems library" },
  { name: "ModelicaServices", desc: "Standard services for MSL" },
  { name: "Complex", desc: "Complex number math library" },
  { name: "Buildings", desc: "LBNL Modelica Buildings library" },
];

export function LibraryModal({
  onLoad,
  onClose,
}: {
  onLoad: (lib: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const [custom, setCustom] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!custom.trim()) return;
    void onLoad(custom.trim());
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Load Modelica Library">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h3>Load Modelica Library</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="modal-body">
          <p className="lbl">Standard Modelica Libraries:</p>
          <div className="lib-quick-list">
            {COMMON_LIBRARIES.map((l) => (
              <button
                key={l.name}
                type="button"
                className="lib-quick-item"
                onClick={() => {
                  void onLoad(l.name);
                  onClose();
                }}
              >
                <b>{l.name}</b>
                <span className="muted">{l.desc}</span>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ marginTop: "12px" }}>
            <label>
              <span>Custom Library Name or File Path:</span>
              <input
                ref={inputRef}
                value={custom}
                placeholder="e.g. MyLib or /path/to/package.mo"
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && onClose()}
              />
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
              <button type="button" className="key small" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="key small run" disabled={!custom.trim()}>
                Load Library
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export function StatusModal({
  status,
  serverUrl,
  onClose,
}: {
  status: OmcStatus;
  serverUrl: string;
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="OMC Runtime Status">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h3>OMC Runtime Diagnostics</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="modal-body">
          <table className="status-table">
            <tbody>
              <tr>
                <td><b>Status</b></td>
                <td>
                  <span className={`chip omc-${status.state}`}>
                    <i aria-hidden="true" />
                    {status.state}
                  </span>
                </td>
              </tr>
              <tr>
                <td><b>Version</b></td>
                <td><code>{status.version || "Unknown"}</code></td>
              </tr>
              <tr>
                <td><b>Server URL</b></td>
                <td><code>{serverUrl}</code></td>
              </tr>
              <tr>
                <td><b>Protocol</b></td>
                <td><code>squero/0 (WebSocket)</code></td>
              </tr>
            </tbody>
          </table>
        </div>
        <footer className="modal-actions">
          <button type="button" className="key small run" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
