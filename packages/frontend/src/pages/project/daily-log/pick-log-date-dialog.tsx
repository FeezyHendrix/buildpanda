import { useEffect, useState } from "react";
import { FormDialog } from "@/components/molecules/form-dialog";
import { INPUT_CLASS } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { formatDayDate, formatWeekday, isIsoDate } from "./daily-log-helpers";

interface PickLogDateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Today, in ISO. The picker defaults here and refuses anything later. */
  today: string;
  onPick: (logDate: string) => void;
}

/**
 * A site agent writes Friday up on Monday morning, so "Add my log" has to let
 * them choose the day. Future days are refused: a diary records what happened.
 */
function PickLogDateDialog({ open, onOpenChange, today, onPick }: PickLogDateDialogProps) {
  const [logDate, setLogDate] = useState(today);

  useEffect(() => {
    if (open) setLogDate(today);
  }, [open, today]);

  const valid = isIsoDate(logDate) && logDate <= today;
  const isFuture = isIsoDate(logDate) && logDate > today;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Which day are you logging?"
      description="Defaults to today. You can write up an earlier day at any time."
      submitLabel="Open that day"
      submitDisabled={!valid}
      onSubmit={() => onPick(logDate)}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pick-log-date">Date</Label>
        <input
          id="pick-log-date"
          type="date"
          value={logDate}
          max={today}
          aria-invalid={isFuture || undefined}
          onChange={(event) => setLogDate(event.target.value)}
          className={INPUT_CLASS}
        />
        {isFuture ? (
          <p className="text-xs text-negative-600">
            That day has not happened yet — pick today or earlier.
          </p>
        ) : isIsoDate(logDate) ? (
          <p className="text-xs text-gray-500">
            {formatWeekday(logDate)}, {formatDayDate(logDate)}
          </p>
        ) : null}
      </div>
    </FormDialog>
  );
}

PickLogDateDialog.displayName = "PickLogDateDialog";

export { PickLogDateDialog, type PickLogDateDialogProps };
