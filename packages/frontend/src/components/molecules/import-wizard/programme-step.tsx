import { useState, useRef, type DragEvent } from "react";
import { useStartProgrammeImport, useProgrammeImportJob, useApplyProgramme } from "@/hooks/use-programme-import";
import { useCompleteImport } from "@/hooks/use-complete-import";
import { useDraftState } from "@/hooks/use-draft-state";
import { QueryError } from "@/components/molecules/query-error";
import { CreatedProjectStep } from "./created-project-step";
import { Button } from "@/components/atoms/button";
import { INPUT_CLASS } from "@/components/atoms/input";
import { Spinner } from "@/components/atoms/spinner";
import { CurrencyPicker } from "@/components/atoms/currency-picker";
import { MoneyInput } from "@/components/atoms/money-input";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { CURRENCY_CODES } from "@/lib/currency";

const CURRENCY_CHOICES = CURRENCY_CODES.slice(0, 5);

const ACCEPT = ".xml,.xls,.xlsx,text/xml,application/xml,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

interface ProgrammeStepProps {
  sessionId: string;
  projectId: string | null;
  onProjectCreated: (id: string) => void;
  onNext: () => void;
}

export function ProgrammeStep({ sessionId, projectId, onProjectCreated, onNext }: ProgrammeStepProps) {
  const [jobId, setJobId] = useDraftState<string | null>(`import:${sessionId}:programme:job`, null);
  const startMutation = useStartProgrammeImport();
  const { data: job, isPending: loadingJob, error: jobError, refetch } = useProgrammeImportJob(jobId);
  const applyMutation = useApplyProgramme();
  const createdProjectId = projectId ?? job?.createdProjectId ?? null;
  const completion = useCompleteImport({ sessionId, jobId, kind: "programme", fileName: job?.fileName, projectId: createdProjectId, onProjectCreated, onNext });

  const [projectName, setProjectName] = useDraftState(`import:${sessionId}:programme:name`, "");
  const [city, setCity] = useDraftState(`import:${sessionId}:programme:city`, "");
  const [stateName, setStateName] = useDraftState(`import:${sessionId}:programme:state`, "");
  const [budgetTotal, setBudgetTotal] = useDraftState(`import:${sessionId}:programme:budget`, "");
  const [currency, setCurrency] = useDraftState(`import:${sessionId}:programme:currency`, "NGN");

  const [errorMsg, setErrorMsg] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setErrorMsg("");
    try {
      const res = await startMutation.mutateAsync(file);
      setJobId(res.id);
    } catch (err) {
      setErrorMsg(getApiErrorMessage(err, "Failed to upload file"));
    }
  };

  const onDragOver = (e: DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const handleApply = async () => {
    if (!jobId) return;
    setErrorMsg("");
    const budgetNum = parseFloat(budgetTotal);
    if (!createdProjectId && (!Number.isFinite(budgetNum) || budgetNum <= 0)) {
      setErrorMsg("Please enter a valid budget.");
      return;
    }
    await completion.complete(async () => {
      const latest = await refetch();
      if (latest.error) throw latest.error;
      if (latest.data?.createdProjectId) return { projectId: latest.data.createdProjectId };
      return applyMutation.mutateAsync({
        jobId,
        input: { projectName, city, state: stateName, budgetTotal: budgetNum, currency },
      });
    });
  };

  if (jobId && jobError) return <QueryError error={jobError} retry={refetch} noun="your uploaded schedule" />;
  if (jobId && loadingJob) return <div className="flex justify-center p-12"><Spinner size="md" /></div>;
  if (createdProjectId) return <CreatedProjectStep onContinue={handleApply} pending={completion.pending} error={completion.error} />;

  if (!jobId) {
    return (
      <div className="flex flex-col max-w-xl mx-auto mt-8">
        <h2 className="text-2xl font-semibold text-ink mb-2">Upload your schedule</h2>
        <p className="text-ink-muted mb-8">Upload a Microsoft Project (.xml) or Excel schedule to auto-generate your project.</p>
        
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={cn(
            "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors",
            isDragging ? "border-primary-500 bg-primary-50" : "border-line bg-white hover:bg-surface-alt",
            startMutation.isPending && "pointer-events-none opacity-50"
          )}
        >
          {startMutation.isPending ? (
            <div className="flex flex-col items-center gap-3">
              <Spinner className="h-8 w-8 text-primary-500" />
              <span className="text-sm font-medium text-ink">Uploading...</span>
            </div>
          ) : (
            <>
              <div className="mb-4 rounded-full bg-surface-alt p-3">
                <svg className="h-6 w-6 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="mb-1 text-sm font-medium text-ink">Click to upload or drag and drop</p>
              <p className="mb-4 text-xs text-ink-muted">.xml or Excel files (in Microsoft Project: File &gt; Save As &gt; XML)</p>
              <Button onClick={() => fileInputRef.current?.click()} variant="secondary">Select File</Button>
              <input type="file" className="hidden" accept={ACCEPT} ref={fileInputRef} onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = "";
              }} />
            </>
          )}
        </div>
        {errorMsg && <p className="mt-4 text-sm text-negative-500">{errorMsg}</p>}
      </div>
    );
  }

  const isPending = job?.status === "pending" || job?.status === "processing";

  return (
    <div className="flex flex-col max-w-xl mx-auto mt-8">
      {isPending ? (
        <div className="flex flex-col items-center p-12 text-center">
          <Spinner className="h-10 w-10 text-primary-500 mb-4" />
          <h3 className="text-lg font-medium">Processing your schedule...</h3>
          <p className="text-ink-muted mt-2">Extracting activities and phases. This might take a minute.</p>
        </div>
      ) : job?.status === "completed" && job.result ? (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-2xl font-semibold text-ink mb-2">Review & Create</h2>
            <p className="text-ink-muted">
              We extracted {job.activityCount} schedule rows across {job.phaseCount} phases
              {job.summaryActivityCount > 0 ? `, including ${job.summaryActivityCount} summary rows` : ""}.
              {job.skippedTaskCount > 0 ? ` ${job.skippedTaskCount} blank project row was skipped.` : ""}
              Add details to create the project.
            </p>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">Project Name</span>
              <input 
                type="text" 
                value={projectName} 
                onChange={(e) => setProjectName(e.target.value)}
                className={INPUT_CLASS}
              />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">City</span>
                <input 
                  type="text" 
                  value={city} 
                  onChange={(e) => setCity(e.target.value)}
                  className={INPUT_CLASS}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">State</span>
                <input 
                  type="text" 
                  value={stateName} 
                  onChange={(e) => setStateName(e.target.value)}
                  className={INPUT_CLASS}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Budget Total</span>
                <MoneyInput
                  value={budgetTotal}
                  onChange={setBudgetTotal}
                  placeholder="0"
                  className={cn(INPUT_CLASS, "text-left")}
                />
              </label>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Currency</span>
                <CurrencyPicker currencies={CURRENCY_CHOICES} value={currency} onChange={setCurrency} />
              </div>
            </div>
          </div>

          {errorMsg || completion.error ? <p role="alert" className="text-sm text-negative-500">{errorMsg || completion.error}</p> : null}

          <Button 
            onClick={handleApply} 
            loading={completion.pending}
            disabled={!projectName || !city || !stateName || !budgetTotal}
            className="w-full mt-4"
          >
            Create Project
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center p-12 text-center">
          <div className="rounded-full bg-negative-50 p-3 mb-4">
            <svg className="h-6 w-6 text-negative-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-ink">Failed to process file</h3>
          <p className="text-ink-muted mt-2">{job?.error || "An unknown error occurred."}</p>
          <Button onClick={() => setJobId(null)} variant="secondary" className="mt-6">Try again</Button>
        </div>
      )}
    </div>
  );
}
