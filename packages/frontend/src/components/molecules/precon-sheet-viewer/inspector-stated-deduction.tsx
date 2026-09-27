import { useState } from "react";
import { Button } from "@/components/atoms/button";
import type { PreconBoqRow, PreconDeduction } from "@/api/precon";
import type { useRowCommands } from "./use-row-commands";

const FIELD = "mt-1 h-8 w-full rounded-md border border-line px-2 text-sm tabular-nums";
const LABEL = "block text-xs font-medium text-gray-600";

interface Props {
  row: PreconBoqRow;
  deduction: PreconDeduction;
  /** Position in the row's deductions list — pinned with the exact entry AND the row version. */
  index: number;
  commands: ReturnType<typeof useRowCommands>;
  onClose: () => void;
}

/**
 * Re-entry of a STATED legacy opening — the engine drafts every opening as
 * `{geometryId: null, unitConfirmed: false}`, a figure nobody checked. The
 * correction states the quantity AND confirms the unit explicitly; no
 * geometry is manufactured for a record that never had one. The command pins
 * the index, the row version and the exact entry shown, so it can never land
 * on a different void.
 */
export function InspectorStatedDeduction({ row, deduction, index, commands, onClose }: Props) {
  const [labelRaw, setLabelRaw] = useState(deduction.label);
  const [qtyRaw, setQtyRaw] = useState(String(deduction.qty));
  const [unitRaw, setUnitRaw] = useState(deduction.unit ?? row.unit ?? "");
  const [unitChecked, setUnitChecked] = useState(false);
  const qty = Number(qtyRaw);
  const target = { index, expect: { label: deduction.label, qty: deduction.qty, unit: deduction.unit ?? null } };
  const valid = Number.isFinite(qty) && qty > 0 && unitRaw.trim() !== "" && unitChecked;

  return (
    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50/50 p-2" data-stated-form>
      <p className="text-xs font-medium text-amber-800">
        Stated figure, unit never confirmed — re-enter it as checked numbers, or take it off the line.
      </p>
      <label className={`${LABEL} mt-1`}>
        Name
        <input aria-label="Stated opening name" className={FIELD} value={labelRaw} onChange={(e) => setLabelRaw(e.target.value)} />
      </label>
      <div className="mt-1 grid grid-cols-2 gap-2">
        <label className={LABEL}>
          Quantity taken off
          <input aria-label="Stated opening quantity" className={FIELD} value={qtyRaw} onChange={(e) => setQtyRaw(e.target.value)} />
        </label>
        <label className={LABEL}>
          Unit
          <input aria-label="Stated opening unit" className={FIELD} value={unitRaw} onChange={(e) => setUnitRaw(e.target.value)} />
        </label>
      </div>
      <label className="mt-1.5 flex items-start gap-2 text-xs font-medium text-gray-800">
        <input type="checkbox" data-stated-unit-confirm className="mt-0.5" checked={unitChecked} onChange={(e) => setUnitChecked(e.target.checked)} />
        I confirm this figure is in {unitRaw.trim() || "the stated unit"} — the engine assumed it and nobody had checked.
      </label>
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          loading={commands.saving}
          disabled={!valid}
          title={unitChecked ? undefined : "Confirm the unit first — that is the whole point of re-entering it"}
          onClick={() =>
            commands.editStatedDeduction(row, target, { label: labelRaw.trim() || undefined, qty, unit: unitRaw.trim() }, onClose)
          }
        >
          Save re-entered figure
        </Button>
        <Button
          size="sm"
          variant="danger"
          data-stated-remove
          loading={commands.saving}
          title="Take this stated figure off the line (reversible from the history)"
          onClick={() => commands.removeStatedDeduction(row, target, onClose)}
        >
          Remove
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
InspectorStatedDeduction.displayName = "InspectorStatedDeduction";
