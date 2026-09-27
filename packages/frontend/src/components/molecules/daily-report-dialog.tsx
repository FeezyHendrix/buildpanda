import { useState } from "react";
import { INPUT_CLASS } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { useDownloadPeriodReport } from "@/hooks/use-daily-logs";
import { REPORT_PERIOD_OPTIONS, type ReportPeriod } from "@/lib/project-types";
import { cn } from "@/lib/utils";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface DailyReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

/**
 * Period report download, as a dialog behind a secondary header action. It
 * used to be a full-width panel above the log list that read like a filter
 * bar but filtered nothing; a report is an occasional action, not page chrome.
 */
function DailyReportDialog({ open, onOpenChange, projectId }: DailyReportDialogProps) {
  const [period, setPeriod] = useState<ReportPeriod>("weekly");
  const [date, setDate] = useState(todayIso);
  const download = useDownloadPeriodReport();

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Download report"
      description="Pick a period; any date inside it selects that week or month."
      submitLabel="Download"
      submitDisabled={!date}
      submitting={download.isPending}
      error={download.error ? "Could not download the report." : null}
      onSubmit={() => download.mutate({ projectId, period, date }, { onSuccess: () => onOpenChange(false) })}
    >
      <div className="flex flex-col gap-1.5">
        <Label>Period</Label>
        <div className="flex flex-wrap gap-2">
          {REPORT_PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPeriod(opt.value)}
              aria-pressed={period === opt.value}
              className={cn(
                "h-9 rounded-full px-3.5 text-xs font-medium transition-colors",
                period === opt.value ? "bg-primary-500 text-white" : "bg-surface-alt text-ink hover:bg-gray-100",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="report-date">Date in period</Label>
        <input
          id="report-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={INPUT_CLASS}
        />
      </div>
    </FormDrawer>
  );
}

DailyReportDialog.displayName = "DailyReportDialog";

export { DailyReportDialog, type DailyReportDialogProps };
