// The Console, as Studio uses it: the live omc log and the messages from the last check.
// The cards themselves come from @paperboat/shared, so another app can use the same list.

import { Console, MessageList, logText, messageCounts, type Log, type Message } from "@paperboat/shared/components";

export type ConsoleTab = "console" | "messages";

export function StudioConsole({
  logs,
  messages,
  tab,
  selected,
  checking,
  onTab,
  onSelect,
  onOpen,
  onCheck,
  onClose,
}: {
  logs: Log[];
  messages: Message[];
  tab: ConsoleTab;
  selected?: Message | null;
  checking?: boolean;
  onTab: (tab: ConsoleTab) => void;
  onSelect?: (message: Message) => void;
  onOpen?: (message: Message) => void;
  onCheck: () => void;
  onClose: () => void;
}) {
  const counts = messageCounts(messages);
  const words =
    tab === "console"
      ? `${logs.length} ${logs.length === 1 ? "line" : "lines"}`
      : `${counts.error} ${counts.error === 1 ? "error" : "errors"} · ${counts.warning} ${counts.warning === 1 ? "warning" : "warnings"}`;

  return (
    <section className="console-window studio-console" role="dialog" aria-label="Console and messages" data-own-keys>
      <header className="console-head">
        <div className="switch" role="tablist" aria-label="Console">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "console"}
            className={`opt${tab === "console" ? " on" : ""}`}
            onClick={() => onTab("console")}
          >
            console
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "messages"}
            className={`opt${tab === "messages" ? " on" : ""}`}
            onClick={() => onTab("messages")}
          >
            messages
            {messages.length > 0 && <span className={`console-count${counts.error ? " bad" : ""}`}>{messages.length}</span>}
          </button>
        </div>
        <span className="lbl">{words}</span>
        <span className="spacer" />
        {tab === "console" && logs.length > 0 && (
          <button
            type="button"
            className="key small"
            title="Copy every line as plain text"
            onClick={() => void navigator.clipboard?.writeText(logs.map(logText).join("\n"))}
          >
            Copy all
          </button>
        )}
        <button type="button" className="key small" title="Close (Esc)" onClick={onClose}>
          Close
        </button>
      </header>

      <div className="console-body">
        {tab === "console" ? (
          <Console logs={logs} />
        ) : (
          <>
            <MessageList
              messages={messages}
              selected={selected}
              onSelect={onSelect}
              onOpen={onOpen}
              empty="No messages. Run Model ▸ Check Model."
            />
            <div className="console-foot">
              <span>Click a message to select its part; the location opens the line.</span>
              <span className="spacer" />
              <button type="button" className="key small ink" disabled={checking} onClick={onCheck}>
                {checking ? "checking…" : "Check model"}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
