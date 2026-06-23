import { useState, useRef, type DragEvent } from "react";
import {
  useStartProjectFileImport,
  useProjectFileImportJob,
  useApplyProjectFile,
} from "@/hooks/use-project-file-import";
import {
  useLinkSessionProject,
  useAttachSessionDocument,
} from "@/hooks/use-import-session";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { Badge } from "@/components/atoms/badge";
import { ToggleRow } from "@/components/atoms/toggle-row";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";

const ACCEPT = ".csv,.xls,.xlsx,.pdf,.docx,.txt,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,text/csv,text/plain";

interface ProjectFileStepProps {
  sessionId: string;
  onProjectCreated: (id: string) => void;
  onNext: () => void;
}

export function ProjectFileStep({
  sessionId,
  onProjectCreated,
  onNext,
}: ProjectFileStepProps) {
  const [jobId, setJobId] = useState<string | null>(null);
  const startMutation = useStartProjectFileImport();
  const { data: job } = useProjectFileImportJob(jobId);
  const applyMutation = useApplyProjectFile();
  const linkSession = useLinkSessionProject();
  const attachDocument = useAttachSessionDocument();

  const [errorMsg, setErrorMsg] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [metadataOn, setMetadataOn] = useState(true);
  const [timelineOn, setTimelineOn] = useState(true);
  const [budgetOn, setBudgetOn] = useState(true);
  const [materialsOn, setMaterialsOn] = useState(true);

  const handleFile = async (file: File) => {
    setErrorMsg("");
    try {
      const res = await startMutation.mutateAsync({ file, sessionId });
      setJobId(res.id);
    } catch (err) {
      setErrorMsg(getApiErrorMessage(err, "Failed to upload file"));
    }
  };

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
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
    try {
      const res = await applyMutation.mutateAsync({
        jobId,
        selection: {
          metadata: metadataOn,
          timeline: timelineOn,
          budget: budgetOn,
          materials: materialsOn,
        },
      });

      onProjectCreated(res.projectId);
      await linkSession.mutateAsync({ sessionId, projectId: res.projectId });
      await attachDocument
        .mutateAsync({
          sessionId,
          kind: "project_file",
          jobId: jobId!,
          status: "applied",
        })
        .catch(() => undefined);

      onNext();
    } catch (err) {
      setErrorMsg(getApiErrorMessage(err, "Failed to apply project file"));
    }
  };

  const isPending = job?.status === "pending" || job?.status === "processing";

  return (
    <div className="flex flex-col max-w-2xl mx-auto mt-4 gap-8 pb-12 w-full">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Import Project File
        </h2>
        <p className="text-gray-500">
          Upload any project document: an Excel workbook, PDF, Word doc or
          brief. We will extract project details, timeline, budget, and materials.
        </p>
      </div>

      {!jobId ? (
        <div className="flex flex-col gap-4">
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={cn(
              "flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl transition-colors bg-gray-50 cursor-pointer",
              isDragging
                ? "border-[#004DE7] bg-blue-50"
                : "border-gray-300 hover:border-gray-400 hover:bg-gray-100",
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="rounded-full bg-white p-3 shadow-sm mb-4">
              <svg
                className="h-6 w-6 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900">
              Click or drag file to this area to upload
            </h3>
            <p className="text-gray-500 text-sm mt-1">
              Supports Excel, PDF, Word, CSV
            </p>

            <input
              type="file"
              className="hidden"
              accept={ACCEPT}
              ref={fileInputRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      ) : isPending ? (
        <div className="flex flex-col items-center p-12 text-center border border-gray-200 rounded-xl bg-gray-50">
          <Spinner className="h-10 w-10 text-[#004DE7] mb-4" />
          <h3 className="text-lg font-medium">Panda AI is reading your file…</h3>
          <p className="text-gray-500 mt-2">
            Extracting project details, timeline, and materials.
          </p>
        </div>
      ) : job?.status === "completed" && job.extraction ? (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Here's what we found in {job.fileName}
            </h3>
            <Button variant="secondary" onClick={() => setJobId(null)}>
              Upload Different File
            </Button>
          </div>

          <div className="flex flex-col gap-4">
            <div className="p-4 border border-[#004DE7]/20 bg-[#EFF4FF] rounded-xl flex flex-col gap-2 relative">
              <div className="absolute top-4 right-4">
                <Badge className="bg-blue-100 text-[#004DE7] border-none font-semibold">
                  Suggested by Panda AI
                </Badge>
              </div>
              <h4 className="font-semibold text-gray-900">
                {job.extraction.metadata.projectName || "Unnamed Project"}
              </h4>
              <div className="grid grid-cols-2 gap-y-2 text-sm text-gray-700 mt-2">
                <div>
                  <span className="text-gray-500">Location:</span>{" "}
                  {job.extraction.metadata.location || "Not specified"}
                </div>
                <div>
                  <span className="text-gray-500">Client:</span>{" "}
                  {job.extraction.metadata.client || "Not specified"}
                </div>
                <div>
                  <span className="text-gray-500">Contractor:</span>{" "}
                  {job.extraction.metadata.contractor || "Not specified"}
                </div>
                <div>
                  <span className="text-gray-500">Dates:</span>{" "}
                  {job.extraction.metadata.startDate || "Not specified"} to{" "}
                  {job.extraction.metadata.endDate || "Not specified"}
                </div>
              </div>
              {job.extraction.metadata.description && (
                <div className="text-sm text-gray-600 mt-2">
                  <span className="text-gray-500">Description:</span>{" "}
                  {job.extraction.metadata.description}
                </div>
              )}
            </div>

            <ToggleRow
              title="Project details"
              description={
                job.extraction.metadata.projectName ? "Found project info" : "Not found"
              }
              checked={metadataOn}
              onChange={setMetadataOn}
            />

            <ToggleRow
              title="Timeline"
              description={`${job.extraction.phases.length} phases`}
              checked={timelineOn}
              onChange={setTimelineOn}
            />

            <ToggleRow
              title="Budget"
              description={`${
                job.extraction.budgetCategories.length
              } categories, total = ₦${job.extraction.budgetCategories
                .reduce((acc, cat) => acc + cat.total, 0)
                .toLocaleString()}`}
              checked={budgetOn}
              onChange={setBudgetOn}
            />

            <ToggleRow
              title="Materials"
              description={`${job.extraction.materials.length} items`}
              checked={materialsOn}
              onChange={setMaterialsOn}
            />
          </div>

          <Button
            onClick={handleApply}
            loading={applyMutation.isPending}
            className="w-full mt-4"
          >
            Create project from this file
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center p-12 text-center border border-gray-200 rounded-xl bg-gray-50">
          <div className="rounded-full bg-red-100 p-3 mb-4">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900">
            Failed to parse file
          </h3>
          <p className="text-gray-500 mt-2">
            {job?.error || "Could not read data from this file."}
          </p>
          <Button
            onClick={() => setJobId(null)}
            variant="secondary"
            className="mt-6"
          >
            Try again
          </Button>
        </div>
      )}

      {errorMsg && (
        <p className="text-sm text-red-600 text-center">{errorMsg}</p>
      )}
    </div>
  );
}
