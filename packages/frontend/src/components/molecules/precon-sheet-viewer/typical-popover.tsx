import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/atoms/button";
import type { PreconBoqRow } from "@/api/precon";
import { isVersionConflict, useSetTypical } from "@/hooks/use-precon";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { formatQty, unitLabel } from "./measure-maths";
import { INPUT_SM_CLASS } from "@/components/atoms/input";
import { cn } from "@/lib/utils";

interface Props {
  sessionId: string;
  row: PreconBoqRow;
  onClose: () => void;
}

const FIELD = cn(INPUT_SM_CLASS, "mt-1");

/**
 * Typical ×N: the selected line is the same on N floors or areas. The backend
 * keeps the drawn quantity as gross and recomputes net and the basis.
 */
export function TypicalPopover({ sessionId, row, onClose }: Props) {
  const [raw, setRaw] = useState(String(row.typical ?? 1));
  const setTypical = useSetTypical(sessionId);
  const n = Math.floor(Number(raw));
  const valid = Number.isInteger(n) && n >= 1;
  const gross = row.qtyGross ?? row.qty ?? 0;
  const deductions = row.deductions.reduce((sum, d) => sum + d.qty, 0);
  const preview = valid ? (gross - deductions) * n : null;

  const apply = () => {
    if (!valid) return;
    setTypical.mutate(
      { rowId: row.id, version: row.version, typical: n },
      {
        onSuccess: (updated) => {
          toast(`${updated.description}: × ${n} typical = ${formatQty(updated.qty ?? 0)} ${unitLabel(updated.unit ?? "")}`, "success");
          onClose();
        },
        onError: (error) => toast(isVersionConflict(error) ? "Row changed elsewhere — refreshed; try again." : getApiErrorMessage(error, "Could not set typical"), "error"),
      },
    );
  };

  return (
    <form
      className="absolute right-3 top-3 z-20 flex w-72 flex-col gap-3 rounded-none border border-line bg-white p-4 shadow-lg"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-caption-l font-semibold text-black-500">Same on N floors or areas</p>
          <p className="text-caption-m text-ink-muted">“{row.description}” — net = (gross − deductions) × N, stated in the basis.</p>
        </div>
        <Button type="button" size="sm" variant="ghost" aria-label="Close" className="size-8 shrink-0 px-0 text-ink-muted" onClick={onClose}>
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>
      <label className="block text-caption-m font-medium text-ink-muted">
        Typical × N
        <input autoFocus className={FIELD} inputMode="numeric" min={1} value={raw} onChange={(e) => setRaw(e.target.value)} />
      </label>
      <p className="rounded-none bg-primary-50 px-3 py-2 text-caption-l text-primary-800">
        {preview !== null ? (
          <>
            {formatQty(gross)}
            {deductions > 0 ? ` − ${formatQty(deductions)}` : ""} × {n} = <span className="font-semibold tabular-nums">{formatQty(preview)}</span> {unitLabel(row.unit ?? "")}
          </>
        ) : (
          "Enter a whole number of 1 or more."
        )}
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" size="sm" loading={setTypical.isPending} disabled={!valid}>
          Apply
        </Button>
      </div>
    </form>
  );
}
TypicalPopover.displayName = "TypicalPopover";
