import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/atoms/button";
import { Label } from "@/components/atoms/label";
import { ProgressBar } from "@/components/atoms/progress-bar";
import { Spinner } from "@/components/atoms/spinner";
import { FormDrawer } from "./form-drawer";
import { cn } from "@/lib/utils";
import { useUploadFile } from "@/hooks/use-files";
import { useScanInvoice, type InvoiceScanResult } from "@/hooks/use-invoices";

interface ScanInvoiceDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScanned: (result: InvoiceScanResult) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ScanInvoiceDialog({
  projectId,
  open,
  onOpenChange,
  onScanned,
}: ScanInvoiceDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const uploadFile = useUploadFile();
  const scanInvoice = useScanInvoice();

  const isSubmitting = uploadFile.isPending || scanInvoice.isPending;
  const isFinalizingUpload = uploadFile.isPending && (uploadProgress === null || uploadProgress >= 100);
  
  const statusLabel = scanInvoice.isPending
    ? "Scanning invoice…"
    : isFinalizingUpload
      ? "Finalizing…"
      : `Uploading… ${uploadProgress ?? 0}%`;

  const error = (uploadFile.error as Error | undefined)?.message ?? (scanInvoice.error as Error | undefined)?.message ?? null;

  useEffect(() => {
    if (!open) {
      setFile(null);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open]);

  const isValid = file !== null;

  function handleSubmit(): void {
    if (!file) return;

    uploadFile.mutate(
      { file, projectId, onProgress: setUploadProgress },
      {
        onSuccess: (uploaded) => {
          scanInvoice.mutate(
            { projectId, fileId: uploaded.id },
            {
              onSuccess: (result) => {
                onOpenChange(false);
                onScanned(result);
              },
            }
          );
        },
      }
    );
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Scan invoice"
      description="Upload an invoice or receipt. The AI will read the details so you don't have to type them."
      submitLabel="Scan"
      submitDisabled={!isValid}
      submitting={isSubmitting}
      error={error}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="scan-document-file">File</Label>
        <input
          ref={fileInputRef}
          id="scan-document-file"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/*"
          onChange={(e) => {
            const picked = e.target.files?.[0] ?? null;
            setFile(picked);
          }}
          className="sr-only"
        />
        <div
          className={cn(
            "flex items-center justify-between gap-3 rounded-lg border-2 border-dashed border-[#D9D9D9] bg-[#FAFAFA] px-3 py-3",
            file && "border-[#004DE7]/30 bg-[#F5F8FF]",
          )}
        >
          <div className="min-w-0">
            {file ? (
              <>
                <p className="truncate text-sm font-medium text-gray-900">
                  {file.name}
                </p>
                <p className="text-[11px] text-gray-500">
                  {formatBytes(file.size)} · {file.type || "Unknown type"}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-500">No file selected</p>
            )}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={isSubmitting}
            className="h-9 px-3 text-xs"
            onClick={() => fileInputRef.current?.click()}
          >
            {file ? "Replace" : "Choose file"}
          </Button>
        </div>

        {isSubmitting && (
          <div className="mt-2 flex flex-col gap-2 rounded-lg border border-[#E4E9F5] bg-[#F5F8FF] px-3 py-3">
            <div className="flex items-center gap-2.5">
              <Spinner size="sm" label={statusLabel} />
              <p className="text-sm font-medium text-gray-900">{statusLabel}</p>
            </div>
            {uploadFile.isPending && (
              <ProgressBar
                value={uploadProgress !== null ? uploadProgress : isFinalizingUpload ? 100 : 0}
                size="md"
              />
            )}
          </div>
        )}
      </div>
    </FormDrawer>
  );
}
