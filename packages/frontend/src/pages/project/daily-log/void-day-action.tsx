import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { VoidDailyLogDialog } from "@/components/molecules/void-daily-log-dialog";
import { useVoidDailyLog } from "@/hooks/use-daily-logs";
import { errorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { formatDayDate } from "./daily-log-helpers";

interface VoidDayActionProps {
  projectId: string;
  logDate: string;
  /** Rendered as the trigger; omit for the default ghost button. */
  label?: string;
}

/**
 * Voiding a whole day keeps the record and the audit trail — the route and the
 * "Voided" tab existed, but nothing in the UI could reach them (finding F9).
 */
function VoidDayAction({ projectId, logDate, label = "Void day" }: VoidDayActionProps) {
  const [open, setOpen] = useState(false);
  const voidDay = useVoidDailyLog();

  return (
    <>
      <Button type="button" variant="danger" size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <VoidDailyLogDialog
        open={open}
        onOpenChange={setOpen}
        logDate={formatDayDate(logDate)}
        submitting={voidDay.isPending}
        error={voidDay.error ? errorMessage(voidDay.error) : null}
        onConfirm={(reason) =>
          voidDay.mutate(
            { projectId, logDate, reason },
            {
              onSuccess: () => {
                setOpen(false);
                toast("Day voided", "success");
              },
            },
          )
        }
      />
    </>
  );
}

VoidDayAction.displayName = "VoidDayAction";

export { VoidDayAction, type VoidDayActionProps };
