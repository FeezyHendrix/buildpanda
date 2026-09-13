import { useCallback, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { Button } from "@/components/atoms/button";
import { INPUT_SM_CLASS } from "@/components/atoms/input";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { currentPeriod, nextPeriod } from "../schedule-of-values-line";
import { PERIOD_PATTERN } from "./billing-sheet-model";

/**
 * Adds a billing month column. The first month is picked (the sheet has no
 * anchor yet); every later click appends the month after the last one, the
 * way a QS extends a sheet. The picker renders in a portal so the sheet's
 * horizontal scroll cannot clip it.
 */

interface AddMonthButtonProps {
  periods: string[];
  onAdd: (period: string) => void;
}

export function AddMonthButton({ periods, onAdd }: AddMonthButtonProps) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(() => currentPeriod());
  const last = periods[periods.length - 1];

  const confirm = useCallback(() => {
    if (!PERIOD_PATTERN.test(picked)) return;
    onAdd(picked);
    setOpen(false);
  }, [picked, onAdd]);

  if (last) {
    return (
      <Button type="button" variant="secondary" size="md" onClick={() => onAdd(nextPeriod(last))}>
        <PlusIcon className="size-4" />
        Add next month
      </Button>
    );
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        render={
          <Button type="button" variant="secondary" size="md">
            <PlusIcon className="size-4" />
            Add month
          </Button>
        }
      />
      <Popover.Portal>
        <Popover.Positioner align="end" sideOffset={8} className="z-[70]">
          <Popover.Popup className="flex w-64 flex-col gap-3 rounded-lg border border-line-hair bg-white p-4 shadow-lg outline-none">
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
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

AddMonthButton.displayName = "AddMonthButton";
