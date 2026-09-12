import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/atoms/button";
import { INPUT_SM_CLASS } from "@/components/atoms/input";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { currentPeriod, nextPeriod } from "../schedule-of-values-line";
import { PERIOD_PATTERN } from "./billing-sheet-model";

/**
 * Adds a billing month column. The first month is picked (the sheet has no
 * anchor yet); every later click appends the month after the last one, the
 * way a QS extends a sheet.
 */

interface AddMonthButtonProps {
  periods: string[];
  onAdd: (period: string) => void;
}

export function AddMonthButton({ periods, onAdd }: AddMonthButtonProps) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(() => currentPeriod());
  const ref = useRef<HTMLDivElement>(null);
  const last = periods[periods.length - 1];

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleClick = useCallback(() => {
    if (last) onAdd(nextPeriod(last));
    else setOpen((value) => !value);
  }, [last, onAdd]);

  const confirm = useCallback(() => {
    if (!PERIOD_PATTERN.test(picked)) return;
    onAdd(picked);
    setOpen(false);
  }, [picked, onAdd]);

  return (
    <div ref={ref} className="relative">
      <Button type="button" variant="secondary" size="md" onClick={handleClick}>
        <PlusIcon className="size-4" />
        {last ? "Add next month" : "Add month"}
      </Button>
      {open ? (
        <div className="absolute right-0 top-full z-20 mt-2 flex w-64 flex-col gap-3 rounded-lg bg-white p-4 shadow-lg border border-line-hair">
          <label className="flex flex-col gap-1.5 text-xs font-medium uppercase text-ink-muted">
            First billing month
            <input
              type="month"
              value={picked}
              autoFocus
              onChange={(event) => setPicked(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") confirm();
              }}
              className={INPUT_SM_CLASS}
            />
          </label>
          <Button type="button" variant="primary" size="sm" onClick={confirm} disabled={!PERIOD_PATTERN.test(picked)}>
            Add month
          </Button>
        </div>
      ) : null}
    </div>
  );
}

AddMonthButton.displayName = "AddMonthButton";
