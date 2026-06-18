import { Dialog } from "@base-ui-components/react/dialog";
import { useRef, useState } from "react";
import { formatShortDate } from "@/lib/formatters";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import {
  documentVersionViewUrl,
  useAddDocumentVersion,
  useDocumentVersions,
} from "@/hooks/use-documents";
import { useUploadFile } from "@/hooks/use-files";
import { cn } from "@/lib/utils";
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [revisionLabel, setRevisionLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [viewer, setViewer] = useState<DocumentVersion | null>(null);

  const busy = uploadFile.isPending || addVersion.isPending;
  const error =
    (uploadFile.error as Error | undefined)?.message ??
    (addVersion.error as Error | undefined)?.message ??
    null;

  function handlePick(file: File | null): void {
    if (!file) return;
    uploadFile.mutate(file, {
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
              if (fileInputRef.current) fileInputRef.current.value = "";
            },
          },
        );
      },
    });
  }

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" />
          <Dialog.Popup
            className={cn(
              "fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col",
              "overflow-hidden rounded-2xl bg-white shadow-xl outline-none",
            )}
          >
            <header className="px-6 pt-6">
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                Version history
              </Dialog.Title>
              <Dialog.Description className="mt-1.5 truncate text-sm text-gray-500">
                {document.fileName}
              </Dialog.Description>
            </header>

            {/* Upload a new revision */}
            {canManage && (
            <div className="mx-6 mt-4 rounded-xl border border-[#EDEDED] bg-[#FAFAFA] p-4">
              <p className="text-sm font-medium text-gray-900">Upload new version</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  value={revisionLabel}
                  onChange={(e) => setRevisionLabel(e.target.value)}
                  placeholder="Revision label (e.g. Rev C)"
                  className="h-10 flex-1 rounded-lg border border-[#EDEDED] bg-white px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
                />
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What changed? (optional)"
                  className="h-10 flex-1 rounded-lg border border-[#EDEDED] bg-white px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
                />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                onChange={(e) => handlePick(e.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-3 h-9 px-4 text-sm"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                {busy ? "Uploading…" : "Choose file & upload"}
              </Button>
              {error && (
                <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
              )}
            </div>
            )}

            {/* History */}
            <div className="mt-4 flex-1 overflow-y-auto px-6 pb-2">
              {isLoading ? (
                <p className="py-6 text-center text-sm text-gray-500">Loading…</p>
              ) : versions.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">No versions yet.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-[#F0F0F0]">
                  {versions.map((v) => (
                    <li key={v.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">
                            v{v.versionNo}
                            {v.revisionLabel ? ` · ${v.revisionLabel}` : ""}
                          </span>
                          {v.isCurrent && (
                            <Badge tone="info" size="sm">
                              Current
                            </Badge>
                          )}
                        </div>
                        <p className="truncate text-xs text-gray-500">
                          {v.fileName} · {v.size} · {formatWhen(v.createdAt)}
                        </p>
                        {v.notes && <p className="mt-0.5 truncate text-xs text-gray-400">{v.notes}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => setViewer(v)}
                        className="shrink-0 text-xs font-medium text-[#004DE7] hover:text-[#0041c4]"
                      >
                        View
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <footer className="flex items-center justify-end gap-2 border-t border-[#F0F0F0] px-6 py-4">
              <Dialog.Close
                render={
                  <Button type="button" variant="secondary" size="sm" className="h-9 px-4 text-sm">
                    Done
                  </Button>
                }
              />
            </footer>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

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
