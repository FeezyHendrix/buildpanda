import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { Spinner } from "@/components/atoms/spinner";
import { PageHeader } from "@/components/molecules/page-header";
import { CurrencyPicker } from "@/components/atoms/currency-picker";
import { getApiErrorMessage } from "@/lib/api-error";
import { CURRENCY_CODES } from "@/lib/currency";
import {
  useStartProgrammeImport,
  useProgrammeImportJob,
  useApplyProgramme,
  type StructuredProgramme,
  type ProgrammePhase,
  type ProgrammeActivity,
} from "@/hooks/use-programme-import";
import { ReactSVG } from "react-svg";
import { icons } from "@/assets/icons/icons";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/atoms/badge";

export default function ImportProgramme() {
  const navigate = useNavigate();
  const [jobId, setJobId] = useState<string | null>(null);

  const startMutation = useStartProgrammeImport();
  const { data: job } = useProgrammeImportJob(jobId);
  const applyMutation = useApplyProgramme();

  const status = job?.status ?? "upload";

  return (
    <div className="flex h-full w-full flex-col bg-[#FCFCFD]">
      <PageHeader
        title="Import programme"
        description="Upload an .mpp or Excel schedule to auto-generate your project."
      />
      
      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="mx-auto max-w-4xl">
          {status === "upload" && (
            <UploadState
              isPending={startMutation.isPending}
              onFileSelect={(file) => {
                startMutation.mutate(file, {
                  onSuccess: (data) => setJobId(data.id),
                });
              }}
              error={startMutation.error ? getApiErrorMessage(startMutation.error) : null}
            />
          )}

          {(status === "pending" || status === "processing") && (
            <Card className="flex flex-col items-center justify-center p-16 text-center shadow-sm">
              <Spinner size="lg" className="mb-6 text-[#004DE7]" />
              <h3 className="mb-2 text-xl font-semibold text-gray-900">
                Panda AI is reading your programme...
              </h3>
              <p className="text-sm text-gray-500">
                {job?.fileName ?? "Analyzing file"}
              </p>
            </Card>
          )}

          {status === "completed" && job?.result && (
            <PreviewState
              result={job.result}
              isApplying={applyMutation.isPending}
              applyError={applyMutation.error ? getApiErrorMessage(applyMutation.error) : null}
              onApply={(input) => {
                applyMutation.mutate(
                  { jobId: job.id, input },
                  {
                    onSuccess: (res) => {
                      navigate(`/project/${res.projectId}/project-chart`);
                    },
                  }
                );
              }}
            />
          )}

          {status === "failed" && (
            <Card className="flex flex-col items-center justify-center p-16 text-center shadow-sm">
              <div className="mb-4 inline-flex size-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                <ReactSVG src={icons.warningCircle} />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">
                Import failed
              </h3>
              <p className="mb-8 text-sm text-gray-500 max-w-md">
                {job?.error ?? "We couldn't parse this file. Make sure it's a valid Microsoft Project (.mpp) or Excel (.xls, .xlsx) schedule."}
              </p>
              <Button onClick={() => setJobId(null)}>Try another file</Button>
            </Card>
          )}
        </div>
      </div>
    </div>
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

  return (
    <Card className="flex flex-col items-center justify-center border-dashed border-2 border-[#EDEDED] p-16 text-center shadow-none transition-colors hover:border-[#004DE7]/50 bg-white">
      <div className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-[#F0F4FF] text-[#004DE7]">
        <ReactSVG src={icons.upload} className="size-6" />
      </div>
      <h3 className="mb-2 text-lg font-semibold text-gray-900">
        Upload schedule file
      </h3>
      <p className="mb-8 text-sm text-gray-500 max-w-sm">
        Drag and drop your Microsoft Project (.mpp) or Excel (.xls, .xlsx) file here, or click to browse.
      </p>
      {error && (
        <div className="mb-6 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <Button
        disabled={isPending}
        onClick={() => fileInputRef.current?.click()}
      >
        Select file
      </Button>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".mpp,.xls,.xlsx,application/vnd.ms-project,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onFileSelect(file);
          }
        }}
      />
    </Card>
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
  const [budgetTotal, setBudgetTotal] = useState<string>("");
  const [currency, setCurrency] = useState("NGN");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onApply({
      projectName: projectName.trim(),
      city: city.trim(),
      state: locationState.trim(),
      budgetTotal: Number(budgetTotal.replace(/[^0-9.]/g, "")) || 0,
      currency,
    });
  };

  const inputClass = "h-10 w-full rounded-lg border border-[#EDEDED] bg-white px-3 text-sm text-gray-900 outline-none focus:border-[#004DE7] focus:ring-1 focus:ring-[#004DE7]";

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Project details</h2>
        <form id="apply-form" onSubmit={submit} className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-sm font-medium text-gray-700">Project Name</label>
            <input
              required
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className={inputClass}
              placeholder="e.g. Lekki Phase 1 Residential"
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">City</label>
            <input
              required
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={inputClass}
              placeholder="e.g. Lagos"
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">State / Region</label>
            <input
              required
              type="text"
              value={locationState}
              onChange={(e) => setLocationState(e.target.value)}
              className={inputClass}
              placeholder="e.g. Lagos State"
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Currency</label>
            <CurrencyPicker
              currencies={CURRENCY_CODES.slice(0, 5)}
              value={currency}
              onChange={setCurrency}
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Total Budget</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-sm text-gray-500">
                {currency}
              </span>
              <input
                required
                type="text"
                inputMode="numeric"
                value={budgetTotal ? Number(budgetTotal.replace(/[^0-9.]/g, "")).toLocaleString("en-US") : ""}
                onChange={(e) => setBudgetTotal(e.target.value)}
                className={cn(inputClass, "pl-12")}
                placeholder="0"
              />
            </div>
          </div>
        </form>
      </Card>

      <Card className="flex flex-col overflow-hidden">
        <div className="border-b border-[#EDEDED] p-4 flex items-center justify-between bg-gray-50/50">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Parsed schedule preview</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {result.phases.length} phases, {result.activities.length} activities
              {result.usedAi && " • Structured with Panda AI"}
            </p>
          </div>
        </div>
        
        <div className="max-h-[400px] overflow-y-auto p-4 bg-white">
          <div className="space-y-6">
            {[...result.phases].sort((a, b) => a.sort - b.sort).map((phase: ProgrammePhase) => {
              const activities = result.activities.filter(
                (a: ProgrammeActivity) => a.phaseKey === phase.key
              );
              if (activities.length === 0) return null;
              
              return (
                <div key={phase.key} className="space-y-3">
                  <h3 className="font-medium text-sm text-gray-900 border-b border-gray-100 pb-1">
                    {phase.name}
                  </h3>
                  <div className="space-y-2">
                    {activities.map((activity: ProgrammeActivity) => (
                      <div
                        key={activity.refId}
                        className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50/50 p-2.5 sm:px-4"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-gray-900">
                              {activity.name}
                            </p>
                            {activity.isMilestone && (
                              <Badge variant="outline" tone="accent" className="shrink-0 text-[10px] py-0 h-4">
                                Milestone
                              </Badge>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                            <span>
                              {new Date(activity.startAt).toLocaleDateString()} –{" "}
                              {new Date(activity.endAt).toLocaleDateString()}
                            </span>
                            {activity.predecessors?.length > 0 && (
                              <span className="flex items-center gap-1 text-gray-400">
                                • {activity.predecessors.length} deps
                              </span>
                            )}
                            {activity.percentComplete > 0 && (
                              <span className="flex items-center gap-1 text-gray-400">
                                • {activity.percentComplete}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {applyError && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {applyError}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="submit"
          form="apply-form"
          disabled={isApplying}
        >
          {isApplying ? "Building..." : "Build project"}
        </Button>
      </div>
    </div>
  );
}
