import { Dialog } from "@base-ui-components/react/dialog";
import { useState, useRef, useCallback, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { CurrencyPicker } from "@/components/atoms/currency-picker";
import { Badge } from "@/components/atoms/badge";
import { getApiErrorMessage } from "@/lib/api-error";
import { CURRENCY_CODES } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { ReactSVG } from "react-svg";
import { icons } from "@/assets/icons/icons";
import {
  useStartProgrammeImport,
  useProgrammeImportJob,
  useApplyProgramme,
  type StructuredProgramme,
  type ProgrammePhase,
  type ProgrammeActivity,
} from "@/hooks/use-programme-import";

interface ImportProgrammeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ACCEPT =
  ".mpp,.xml,.xls,.xlsx,application/vnd.ms-project,text/xml,application/xml,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const CURRENCY_CHOICES = CURRENCY_CODES.slice(0, 5);

function ImportProgrammeDialog({ open, onOpenChange }: ImportProgrammeDialogProps) {
  const navigate = useNavigate();
  const [jobId, setJobId] = useState<string | null>(null);

  const startMutation = useStartProgrammeImport();
  const { data: job } = useProgrammeImportJob(jobId);
  const applyMutation = useApplyProgramme();

  const status = job?.status ?? "upload";

  function reset(): void {
    setJobId(null);
    startMutation.reset();
    applyMutation.reset();
  }

  function handleOpenChange(next: boolean): void {
    if (!next) reset();
    onOpenChange(next);
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/30 backdrop-blur-sm transition-opacity duration-300",
            "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
          )}
        />
        <Dialog.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[min(720px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-white shadow-xl outline-none",
            "transition-all duration-300 ease-out",
            "data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
          )}
        >
          <header className="flex items-start justify-between border-b border-[#F0F0F0] px-6 py-5">
            <div>
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                Import programme
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-gray-500">
                Upload a Microsoft Project (.xml) or Excel schedule to auto-generate your project.
              </Dialog.Description>
            </div>
            <Dialog.Close
              render={
                <button
                  type="button"
                  aria-label="Close"
                  className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path
                      d="M4 4l8 8M12 4l-8 8"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              }
            />
          </header>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {status === "upload" && (
              <UploadState
                isPending={startMutation.isPending}
                onFileSelect={(file) =>
                  startMutation.mutate(file, { onSuccess: (data) => setJobId(data.id) })
                }
                error={startMutation.error ? getApiErrorMessage(startMutation.error) : null}
              />
            )}

            {(status === "pending" || status === "processing") && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Spinner size="lg" className="mb-6 text-[#004DE7]" />
                <h3 className="mb-2 text-xl font-semibold text-gray-900">
                  Panda AI is reading your programme...
                </h3>
                <p className="text-sm text-gray-500">{job?.fileName ?? "Analyzing file"}</p>
              </div>
            )}

            {status === "completed" && job?.result && (
              <PreviewState
                result={job.result}
                isApplying={applyMutation.isPending}
                applyError={applyMutation.error ? getApiErrorMessage(applyMutation.error) : null}
                onApply={(input) =>
                  applyMutation.mutate(
                    { jobId: job.id, input },
                    { onSuccess: (res) => navigate(`/project/${res.projectId}/project-chart`) },
                  )
                }
              />
            )}

            {status === "failed" && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 inline-flex size-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <ReactSVG src={icons.warningCircle} />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-gray-900">Import failed</h3>
                <p className="mb-8 max-w-md text-sm text-gray-500">
                  {job?.error ??
                    "We couldn't parse this file. In Microsoft Project use File → Save As → XML (*.xml) and upload that, or upload an Excel (.xls, .xlsx) schedule."}
                </p>
                <Button onClick={reset}>Try another file</Button>
              </div>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function UploadState({
  isPending,
  onFileSelect,
  error,
}: {
  isPending: boolean;
  onFileSelect: (f: File) => void;
  error: string | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const openPicker = useCallback(() => fileInputRef.current?.click(), []);

  function handleDrop(event: DragEvent<HTMLButtonElement>): void {
    event.preventDefault();
    setDragging(false);
    if (isPending) return;
    const file = event.dataTransfer.files?.[0];
    if (file) onFileSelect(file);
  }

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={openPicker}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-white px-6 py-14 text-center transition-colors",
          dragging ? "border-[#004DE7] bg-[#F0F4FF]" : "border-[#EDEDED] hover:border-[#004DE7]/50",
          isPending && "cursor-not-allowed opacity-60",
        )}
      >
        <span className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-[#F0F4FF] text-[#004DE7]">
          <ReactSVG src={icons.upload} className="size-6" />
        </span>
        <span className="mb-2 text-lg font-semibold text-gray-900">
          {isPending ? "Uploading…" : "Upload schedule file"}
        </span>
        <span className="max-w-sm text-sm text-gray-500">
          Drag and drop your file here, or click to browse.
        </span>
        <span className="mt-3 text-xs font-medium text-gray-400">
          Accepts .mpp · .xml · .xls · .xlsx
        </span>
      </button>

      <div className="mt-4 rounded-xl border border-[#EDEDED] bg-[#FAFBFF] p-4">
        <p className="mb-2 text-sm font-semibold text-gray-900">Using Microsoft Project?</p>
        <ol className="list-decimal space-y-1 pl-4 text-sm text-gray-600">
          <li>Open your schedule in Microsoft Project.</li>
          <li>
            Go to <span className="font-medium text-gray-800">File → Save As</span> and choose{" "}
            <span className="font-medium text-gray-800">XML (*.xml)</span> as the file type.
          </li>
          <li>Upload the saved <span className="font-medium text-gray-800">.xml</span> file here.</li>
        </ol>
        <p className="mt-2 text-xs text-gray-400">
          Exporting to XML preserves your tasks, dependencies, % complete and milestones. Excel
          (.xls/.xlsx) schedules work too.
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept={ACCEPT}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelect(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function PreviewState({
  result,
  isApplying,
  applyError,
  onApply,
}: {
  result: StructuredProgramme;
  isApplying: boolean;
  applyError: string | null;
  onApply: (data: {
    projectName: string;
    city: string;
    state: string;
    budgetTotal: number;
    currency: string;
  }) => void;
}) {
  const [projectName, setProjectName] = useState(result.projectName || "");
  const [city, setCity] = useState("");
  const [locationState, setLocationState] = useState("");
  const [budgetTotal, setBudgetTotal] = useState("");
  const [currency, setCurrency] = useState("NGN");

  const milestoneCount = result.activities.filter((a) => a.isMilestone).length;
  const canSubmit = projectName.trim() && city.trim() && locationState.trim();

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    onApply({
      projectName: projectName.trim(),
      city: city.trim(),
      state: locationState.trim(),
      budgetTotal: Number(budgetTotal.replace(/[^0-9.]/g, "")) || 0,
      currency,
    });
  }

  const inputClass =
    "h-10 w-full rounded-lg border border-[#EDEDED] bg-white px-3 text-sm text-gray-900 outline-none focus:border-[#004DE7] focus:ring-1 focus:ring-[#004DE7]";

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">Project details</h3>
          <Badge tone="neutral" size="md">
            {result.phases.length} phases · {result.activities.length} activities
            {milestoneCount > 0 ? ` · ${milestoneCount} milestones` : ""}
          </Badge>
          {result.usedAi ? (
            <Badge tone="info" size="md">
              Panda AI
            </Badge>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Project name</span>
            <input
              className={inputClass}
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. Lekki Phase 1 Residential"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Currency</span>
            <CurrencyPicker currencies={CURRENCY_CHOICES} value={currency} onChange={setCurrency} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">City</span>
            <input
              className={inputClass}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Lagos"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">State / Region</span>
            <input
              className={inputClass}
              value={locationState}
              onChange={(e) => setLocationState(e.target.value)}
              placeholder="e.g. Lagos State"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-gray-600">Total budget</span>
            <input
              className={inputClass}
              value={budgetTotal}
              onChange={(e) => setBudgetTotal(e.target.value)}
              inputMode="numeric"
              placeholder="0"
            />
          </label>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-900">Parsed schedule preview</h3>
        <div className="max-h-64 space-y-3 overflow-y-auto rounded-xl border border-[#EDEDED] p-3">
          {result.phases.map((phase) => (
            <PhasePreview key={phase.key} phase={phase} activities={result.activities} />
          ))}
        </div>
      </div>

      {applyError && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{applyError}</div>
      )}

      <div className="flex items-center justify-end">
        <Button type="submit" disabled={!canSubmit || isApplying}>
          {isApplying ? "Building project…" : "Build project"}
        </Button>
      </div>
    </form>
  );
}

function PhasePreview({
  phase,
  activities,
}: {
  phase: ProgrammePhase;
  activities: ProgrammeActivity[];
}) {
  const phaseActivities = activities.filter((a) => a.phaseKey === phase.key);
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {phase.name}
      </p>
      <div className="space-y-1">
        {phaseActivities.map((activity) => (
          <ActivityPreview key={activity.refId} activity={activity} />
        ))}
      </div>
    </div>
  );
}

function ActivityPreview({ activity }: { activity: ProgrammeActivity }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-[#FAFAFA] px-3 py-2 text-sm">
      <span className="truncate text-gray-900">{activity.name}</span>
      <span className="ml-3 flex shrink-0 items-center gap-2 text-xs text-gray-500">
        {formatRange(activity.startAt, activity.endAt)}
        {activity.isMilestone ? (
          <Badge tone="warning" size="sm">
            Milestone
          </Badge>
        ) : null}
        {activity.predecessors.length > 0 ? (
          <span className="text-gray-400">· {activity.predecessors.length} deps</span>
        ) : null}
      </span>
    </div>
  );
}

function formatRange(start: string, end: string): string {
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB");
  return `${fmt(start)} – ${fmt(end)}`;
}

ImportProgrammeDialog.displayName = "ImportProgrammeDialog";

export { ImportProgrammeDialog, type ImportProgrammeDialogProps };
