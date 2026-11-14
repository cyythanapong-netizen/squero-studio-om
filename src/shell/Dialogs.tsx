// The Studio's small dialogs, each the shared Modal (Esc, a press outside, focus back to the opener).
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Modal } from "@paperboat/shared/components";

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
    <Modal title={title} onClose={onClose}>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <label>
              <span>{label}</span>
              <input
                ref={inputRef}
                value={val}
                placeholder={placeholder}
                onChange={(e) => setVal(e.target.value)}
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
    </Modal>
  );
}

export function ConfirmModal({
  title,
  body,
  confirmLabel = "Delete",
  onConfirm,
  onClose,
}: {
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => cancel.current?.focus(), []);
  return (
    <Modal title={title} onClose={onClose}>
        <div className="modal-body">
          <p className="lbl">{body}</p>
        </div>
        <footer className="modal-actions">
          <button ref={cancel} type="button" className="key small" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="key small err"
            onClick={() => {
              void onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </footer>
    </Modal>
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
    <Modal title="Load Modelica Library" onClose={onClose}>
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
    </Modal>
  );
}
