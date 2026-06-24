import { Dialog } from "@base-ui-components/react/dialog";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { ReactSVG } from "react-svg";
import { icons } from "@/assets/icons/icons";
import {
  useStartProgrammeImport,
  useProgrammeImportJob,
  useApplyProgramme,
} from "@/hooks/use-programme-import";

interface ImportProgrammeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
}

import { UploadState } from "./import-programme-dialog/upload-state";
import { PreviewState } from "./import-programme-dialog/preview-state";

function ImportProgrammeDialog({ open, onOpenChange, projectId }: ImportProgrammeDialogProps) {
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
                projectId={projectId}
                isApplying={applyMutation.isPending}
                applyError={applyMutation.error ? getApiErrorMessage(applyMutation.error) : null}
                onApply={(input) =>
                  applyMutation.mutate(
                    { jobId: job.id, input: { ...input, projectId } },
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

ImportProgrammeDialog.displayName = "ImportProgrammeDialog";

export { ImportProgrammeDialog, type ImportProgrammeDialogProps };
