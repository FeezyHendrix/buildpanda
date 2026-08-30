import { useState } from "react";
import { useCreateDocument } from "@/hooks/use-documents";
import { useUploadFile } from "@/hooks/use-files";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api-error";
import { toast } from "@/lib/toast";

export interface DocumentUploader {
  open: boolean;
  handleOpenChange: (next: boolean) => void;
  upload: (input: { categoryId: string; file: File }) => void;
  isUploading: boolean;
  progress: number | null;
  error: string | null;
}

/**
 * Shared two-step upload flow (file upload → document record) used by the
 * Documents, Plans and Media Library pages. 401/403 are surfaced globally by
 * the axios interceptor; everything else is toasted so a failure is never
 * silent.
 */
export function useDocumentUpload(
  projectId: string,
  successMessage: string,
): DocumentUploader {
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const uploadFile = useUploadFile();
  const createDocument = useCreateDocument();

  const isUploading = uploadFile.isPending || createDocument.isPending;
  const error = uploadFile.error
    ? getApiErrorMessage(uploadFile.error)
    : createDocument.error
      ? getApiErrorMessage(createDocument.error)
      : null;

  function notifyError(err: unknown): void {
    const status = getApiErrorStatus(err);
    if (status === 401 || status === 403) return;
    toast(getApiErrorMessage(err), "error");
  }

  function handleOpenChange(next: boolean): void {
    if (!next && isUploading) return;
    if (!next) setProgress(null);
    setOpen(next);
  }

  function upload(input: { categoryId: string; file: File }): void {
    setProgress(0);
    uploadFile.mutate(
      { file: input.file, onProgress: setProgress },
      {
        onSuccess: (uploaded) => {
          createDocument.mutate(
            { projectId, categoryId: input.categoryId, fileId: uploaded.id },
            {
              onSuccess: () => {
                setOpen(false);
                setProgress(null);
                toast(successMessage, "success");
              },
              onError: (err) => {
                setProgress(null);
                notifyError(err);
              },
            },
          );
        },
        onError: (err) => {
          setProgress(null);
          notifyError(err);
        },
      },
    );
  }

  return { open, handleOpenChange, upload, isUploading, progress, error };
}
