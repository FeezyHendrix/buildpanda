import { useCallback, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { Button } from "@/components/atoms/button";
import { CreateButton } from "@/components/molecules/create-button";
import { INPUT_SM_CLASS } from "@/components/atoms/input";
import { currentPeriod, nextPeriod } from "../schedule-of-values-line";
import { PERIOD_PATTERN, formatPeriodHeading, isForecastPeriod } from "./billing-sheet-model";

/**
 * Adds a billing month column. Always a picker, so a QS can add a month out of
 * sequence — a job that stopped for the rains does not bill in a neat run — and
 * the panel says up front when the month picked is a forecast rather than a
 * month that can be claimed.
 *
 * The picker renders in a portal so the sheet's horizontal scroll cannot clip it.
 */

interface AddMonthButtonProps {
  periods: string[];
  onAdd: (period: string) => void;
}

export function AddMonthButton({ periods, onAdd }: AddMonthButtonProps) {
  const [open, setOpen] = useState(false);
  const last = periods[periods.length - 1];
  const [picked, setPicked] = useState(() => (last ? nextPeriod(last) : currentPeriod()));

  const confirm = useCallback(() => {
    if (!PERIOD_PATTERN.test(picked)) return;
    onAdd(picked);
    setOpen(false);
  }, [picked, onAdd]);

  const valid = PERIOD_PATTERN.test(picked);
  const forecast = valid && isForecastPeriod(picked);
  const duplicate = periods.includes(picked);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setPicked(last ? nextPeriod(last) : currentPeriod());
      }}
    >
      <Popover.Trigger
        render={
          <CreateButton type="button" variant="secondary">
            Add month
     </CreateButton>
        }
      />
      <Popover.Portal>
        <Popover.Positioner align="end" sideOffset={8} className="z-[70]">
          <Popover.Popup className="flex w-72 flex-col gap-3 rounded-lg border border-line-hair bg-white p-4 shadow-lg outline-none">
            <label className="flex flex-col gap-1.5 text-xs font-medium uppercase text-ink-muted">
              Billing month
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
            {duplicate ? (
              <p className="text-xs leading-snug text-negative-600">
                {formatPeriodHeading(picked)} is already on the sheet.
              </p>
            ) : forecast ? (
              <p className="text-xs leading-snug text-ink-muted">
                {formatPeriodHeading(picked)} has not been worked yet. It is added as a forecast
                column — a projection you can value, but never a month anyone can claim.
              </p>
            ) : null}
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={confirm}
              disabled={!valid || duplicate}
            >
              {forecast ? "Add forecast month" : "Add month"}
            </Button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

AddMonthButton.displayName = "AddMonthButton";
