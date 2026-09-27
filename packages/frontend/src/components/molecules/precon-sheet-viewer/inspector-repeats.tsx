import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import type { PreconBoqRow } from "@/api/precon";
import type { useRowCommands } from "./use-row-commands";

const FIELD = "mt-1 h-8 w-full rounded-md border border-line px-2 text-sm";

interface Props {
  row: PreconBoqRow;
  commands: ReturnType<typeof useRowCommands>;
}

/**
 * Contract 8's named repetitions: the labels ARE the multiplier — N counts the
 * measured instance, so twelve names is ×12 with the original included. One
 * label can be split off as its own line (an exception) only after an explicit
 * confirmation; the total is unchanged until the exception is edited. The
 * saved names come back on `row.measurementSettings.repeatLabels`; placeholders
 * are seeded only when a legacy row recorded none.
 */
export function InspectorRepeats({ row, commands }: Props) {
  const typical = row.typical ?? 1;
  const [open, setOpen] = useState(false);
  const saved = row.measurementSettings?.repeatLabels;
  const [labelsRaw, setLabelsRaw] = useState(() =>
    (saved && saved.length > 0 ? saved : Array.from({ length: typical }, (_, i) => (i === 0 ? "As measured" : `Repeat ${i + 1}`))).join("\n"),
  );
  const [splitting, setSplitting] = useState<string | null>(null);
  const labels = labelsRaw.split("\n").map((label) => label.trim()).filter((label) => label !== "");

  return (
    <div data-repeats>
      <button type="button" className="text-xs font-semibold text-gray-900 underline-offset-2 hover:underline" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        Named repetitions (×{typical}) {open ? "▾" : "▸"}
      </button>
      {open ? (
        <div className="mt-1 rounded-md border border-line p-2">
          <label className="block text-xs font-medium text-gray-600">
            One name per line — the count of names IS the ×N, measured instance included
            <textarea aria-label="Repeat labels" className={`${FIELD} h-24 resize-y font-mono text-xs`} value={labelsRaw} onChange={(e) => setLabelsRaw(e.target.value)} />
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <Button size="sm" loading={commands.saving} disabled={labels.length < 1} onClick={() => commands.setRepeatLabels(row, labels)}>
              Apply ×{Math.max(labels.length, 1)}
            </Button>
            <span className="text-xs text-gray-500">net = (gross − deductions) × {Math.max(labels.length, 1)}</span>
          </div>
          {labels.length > 1 ? (
            <ul className="mt-2 space-y-0.5">
              {labels.slice(1).map((label) => (
                <li key={label} className="flex items-center justify-between gap-2 text-xs text-gray-700">
                  <span className="min-w-0 truncate">{label}</span>
                  <button type="button" className="shrink-0 text-primary-600 underline" onClick={() => setSplitting(label)}>
                    Bill separately
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <ConfirmDialog
        open={splitting !== null}
        onOpenChange={(o) => {
          if (!o) setSplitting(null);
        }}
        onConfirm={() => {
          if (splitting) commands.splitRepeatException(row, splitting);
          setSplitting(null);
        }}
        title={`Bill “${splitting ?? ""}” as its own line?`}
        description="The instance leaves this set (×N falls by one) and becomes an independent line with the same measurement. The session total is unchanged until the new line is edited."
        confirmLabel="Split it off"
        cancelLabel="Keep in the set"
      />
    </div>
  );
}
InspectorRepeats.displayName = "InspectorRepeats";
