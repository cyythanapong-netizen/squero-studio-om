// A compact side picker for a pin: four words in a select, not a wide switch row.
import type { IconPort } from "@paperboat/shared";
import { SIDE_OPTIONS } from "./look.ts";

export function SideSelect({ value, onChange, label }: { value: IconPort["side"]; onChange: (side: IconPort["side"]) => void; label: string }) {
  return (
    <select className="icon-side-select" aria-label={label} value={value} onChange={(e) => onChange(e.target.value as IconPort["side"])}>
      {SIDE_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
