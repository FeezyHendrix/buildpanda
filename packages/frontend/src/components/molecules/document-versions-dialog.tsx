import { useEffect, useState } from "react";
import { formatShortDate } from "@/lib/formatters";
import { Badge } from "@/components/atoms/badge";
import { TextArea } from "@/components/atoms/text-area";
import { TextInput } from "@/components/atoms/text-input";
import { FormDrawer } from "./form-drawer";
import { MediaDropzone } from "./media-dropzone";
import {
  documentVersionViewUrl,
  useAddDocumentVersion,
  useDocumentVersions,
} from "@/hooks/use-documents";
import { useUploadFile } from "@/hooks/use-files";
import type { DocumentVersion, ProjectDocument } from "@/lib/project-types";
import { FileViewerDialog } from "./file-viewer-dialog";

interface DocumentVersionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  document: ProjectDocument;
  /** Whether the viewer may upload new versions. Read-only when false. */
  canManage?: boolean;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatWhen(value: string): string {
  return formatShortDate(value) || value;
}

function DocumentVersionsDialog({
  open,
  onOpenChange,
  projectId,
  document,
  canManage = false,
}: DocumentVersionsDialogProps) {
  const { data: versions = [], isLoading } = useDocumentVersions(projectId, document.id);
  const uploadFile = useUploadFile();
  const addVersion = useAddDocumentVersion();
  const [revisionLabel, setRevisionLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<DocumentVersion | null>(null);

  useEffect(() => {
    if (!open) return;
    setRevisionLabel("");
    setNotes("");
    setPickedFile(null);
    setFileError(null);
    setViewer(null);
  }, [open ]);

  const busy = uploadFile.isPending || addVersion.isPending;
  const error =
    fileError ??
    (uploadFile.error as Error | undefined)?.message ??
    (addVersion.error as Error | undefined)?.message ??
    null;

  function handleFiles(files: FileList): void {
    const file = files[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setPickedFile(null);
      setFileError("File is too large. Maximum size is 10MB.");
      return;
    }
    setFileError(null);
    setPickedFile(file);
  }

  function handleUpload(): void {
    if (!pickedFile || busy) return;
    const file = pickedFile;
    uploadFile.mutate(
      { file },
      {
        onSuccess: (uploaded) => {
          addVersion.mutate(
            {
              projectId,
              documentId: document.id,
              fileId: uploaded.id,
              revisionLabel: revisionLabel.trim() || undefined,
              notes: notes.trim() || undefined,
            },
            {
              onSuccess: () => {
                setRevisionLabel("");
                setNotes("");
                setPickedFile(null);
                setFileError(null);
              },
            },
          );
        },
      },
    );
  }

  return (
    <>
      <FormDrawer
        open={open}
        onOpenChange={onOpenChange}
        title="Upload New Version"
        submitLabel={canManage ? "Upload" : "Done"}
        submitDisabled={canManage ? !pickedFile || busy : false}
        submitting={canManage ? busy : false}
        error={error}
        onSubmit={() => {
          if (!canManage) {
            onOpenChange(false);
            return;
          }
          handleUpload();
        }}
        footerVariant="stacked"
      >
        {canManage && (
          <>
            <TextInput
              label="Revision Label"
              value={revisionLabel}
              onChange={setRevisionLabel}
              placeholder="Rev C"
            />

            <TextArea
              label="What Changed?"
              optional
              value={notes}
              onChange={setNotes}
              rows={5}
            />

            <div className="flex flex-col gap-1.5">
              <p className="text-[13px] font-medium text-[#1E1E1E]">File</p>
              <MediaDropzone
                multiple={false}
                hint="(max. 10MB)"
                onFiles={handleFiles}
                disabled={busy}
              />
              {pickedFile && (
                <div className="flex items-center justify-between gap-2 border border-[#EBEBEB] bg-white px-3 py-2">
                  <p className="min-w-0 truncate text-[13px] text-[#1E1E1E]">
                    {pickedFile.name}{" "}
                    <span className="text-xs text-[#9CA3AF]">
                      · {formatFileSize(pickedFile.size)}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setPickedFile(null)}
                    aria-label="Remove selected file"
                    className="flex size-6 shrink-0 items-center justify-center rounded-full text-[#9CA3AF] outline-none hover:bg-[#F5F5F5] hover:text-[#1E1E1E]"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-[#F0F0F0]" aria-hidden />
          </>
        )}

        <div className="flex flex-col">
          {isLoading ? (
            <p className="py-6 text-center text-sm text-[#9CA3AF]">Loading…</p>
          ) : versions.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#9CA3AF]">No versions yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-[#F0F0F0]">
              {versions.map((v) => (
                <li key={v.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#1E1E1E]">
                        V{v.versionNo}
                      </span>
                      {v.isCurrent && (
                        <Badge tone="info" size="sm">
                          Current
                        </Badge>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setViewer(v)}
                      className="shrink-0 text-xs font-medium text-[#004DE7] outline-none hover:underline"
                    >
                      View
                    </button>
                  </div>
                  <p className="mt-1 truncate text-xs text-[#767676]">
                    {v.fileName} · {v.size} · {formatWhen(v.createdAt)}
                  </p>
                  {v.notes && (
                    <p className="mt-0.5 truncate text-xs text-[#9CA3AF]">{v.notes}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </FormDrawer>

      {viewer && (
        <FileViewerDialog
          open={viewer !== null}
          onOpenChange={(o) => !o && setViewer(null)}
          title={`v${viewer.versionNo}${viewer.revisionLabel ? ` · ${viewer.revisionLabel}` : ""}`}
          fileName={viewer.fileName}
          url={documentVersionViewUrl(projectId, document.id, viewer.id)}
        />
      )}
    </>
  );
}

DocumentVersionsDialog.displayName = "DocumentVersionsDialog";

export { DocumentVersionsDialog };
