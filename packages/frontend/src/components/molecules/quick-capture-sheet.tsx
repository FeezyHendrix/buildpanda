import { useDraftState } from "@/hooks/use-draft-state";
import { useDraftFiles } from "@/hooks/use-draft-files";
import { useRef, useState, useEffect } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/atoms/button";
import { uploadFileRequest, resolveFileUrl } from "@/hooks/use-files";
import { useAddDailyLogEntry } from "@/hooks/use-daily-logs";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { INPUT_CLASS } from "@/components/atoms/input";

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}

interface QuickCaptureSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

function PhotoPreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const preview = URL.createObjectURL(file);
    setUrl(preview);
    return () => URL.revokeObjectURL(preview);
  }, [file]);

  return (
    <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
      <img src={url} alt="" className="h-full w-full object-cover" />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove photo"
        className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white"
      >
        ×
      </button>
    </div>
  );
}

/**
 * Bottom-sheet "capture from site" flow: photo(s) + a one-line note posted as
 * a daily-log entry for today (photos embed as <img data-file-id> in bodyHtml,
 * the same convention the rich-text editor uses for daily-log images).
 */
function QuickCaptureSheet({ open, onOpenChange, projectId }: QuickCaptureSheetProps) {
  const draft = useDraftFiles(`capture:${projectId}`);
  const [note, setNote] = useDraftState<string>(`capture:${projectId}:note`, "");
  const [submitting, setSubmitting] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const libraryInputRef = useRef<HTMLInputElement | null>(null);
  const addEntry = useAddDailyLogEntry();

  const canSubmit = draft.files.length > 0 || note.trim().length > 0;

  function addFiles(list: FileList | null): void {
    if (!draft.ready || !list || list.length === 0) return;
    draft.setFiles(current => [...current, ...Array.from(list)]);
  }

  async function reset(): Promise<void> {
    await draft.clear();
    setNote("");
  }

  function handleOpenChange(next: boolean): void {
    if (submitting) return;
    onOpenChange(next);
  }

  async function handleSubmit(): Promise<void> {
    if (!canSubmit || submitting || !draft.ready) return;
    setSubmitting(true);
    try {
      const uploaded = await Promise.all(
        draft.files.map(async (file) => {
          const meta = await uploadFileRequest(file, undefined, projectId);
          const url = await resolveFileUrl(meta.id);
          return { id: meta.id, url, name: meta.fileName };
        }),
      );
      const trimmedNote = note.trim();
      const noteHtml = trimmedNote ? `<p>${escapeHtml(trimmedNote)}</p>` : "";
      const imagesHtml = uploaded
        .map(
          (u) =>
            `<img src="${escapeHtml(u.url)}" alt="${escapeHtml(u.name)}" data-file-id="${escapeHtml(u.id)}">`,
        )
        .join("");
      await addEntry.mutateAsync({
        projectId,
        logDate: todayIso(),
        bodyHtml: `${noteHtml}${imagesHtml}`,
        bodyText: trimmedNote || "Site photos",
      });
      toast("Added to today's daily log", "success");
      await reset();
      onOpenChange(false);
    } catch {
      toast("Could not post your capture");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm lg:hidden" />
        <Dialog.Popup
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col",
            "rounded-t-2xl bg-white shadow-xl outline-none lg:hidden",
          )}
        >
          <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-gray-200" />
          <header className="shrink-0 px-5 pt-3">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              Capture from site
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-gray-500 text-pretty">
              Photos and a quick note go into today's daily log when you post.
            </Dialog.Description>
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className={cn(
                  "flex h-20 flex-1 flex-col items-center justify-center gap-1.5 rounded-lg",
                  "border border-dashed border-gray-300 text-gray-600 transition-colors",
                  "outline-none active:bg-gray-50 focus-visible:shadow-focus",
                )}
              >
                <CameraIcon className="size-5 text-gray-500" />
                <span className="text-xs font-medium">Take photo</span>
              </button>
              <button
                type="button"
                onClick={() => libraryInputRef.current?.click()}
                className={cn(
                  "flex h-20 flex-1 flex-col items-center justify-center gap-1.5 rounded-lg",
                  "border border-dashed border-gray-300 text-gray-600 transition-colors",
                  "outline-none active:bg-gray-50 focus-visible:shadow-focus",
                )}
              >
                <ImageIcon className="size-5 text-gray-500" />
                <span className="text-xs font-medium">Choose photos</span>
              </button>
            </div>

            {draft.files.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {draft.files.map((file, index) => (
                  <PhotoPreview
                    key={`${file.name}:${file.lastModified}:${index}`}
                    file={file}
                    onRemove={() => draft.setFiles(current => current.filter((_, i) => i !== index))}
                  />
                ))}
              </div>
            ) : null}

            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a short note (optional)"
              enterKeyHint="done"
              className={INPUT_CLASS}
            />
          </div>

          <p className="px-5 pb-3 text-xs text-ink-muted" role="status">{draft.error ? "Device storage is unavailable. Keep this page open until you post." : draft.saved ? "Photo draft saved on this device. Your note is saved in this tab." : "Saving photo draft…"}</p>
          <footer className="shrink-0 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button
              type="button"
              variant="primary"
              size="lg" className="w-full"
              disabled={!canSubmit || !draft.ready}
              loading={submitting}
              onClick={() => void handleSubmit()}
            >
              Post to daily log
            </Button>
            <Button variant="secondary" className="mt-2 w-full" onClick={() => onOpenChange(false)} disabled={submitting}>Save for later</Button>
          </footer>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={libraryInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

QuickCaptureSheet.displayName = "QuickCaptureSheet";

interface QuickCaptureProps {
  projectId: string;
}

/** Mobile-only FAB that opens the quick-capture sheet. Safe-area aware. */
function QuickCapture({ projectId }: QuickCaptureProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Capture from site"
        className={cn(
          "fixed right-6 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-40 lg:hidden",
          "flex size-14 items-center justify-center rounded-full bg-primary-500 text-white shadow-lg",
          "outline-none transition-transform active:scale-95 focus-visible:shadow-focus",
        )}
      >
        <CameraIcon className="size-6" />
      </button>
      <QuickCaptureSheet open={open} onOpenChange={setOpen} projectId={projectId} />
    </>
  );
}

QuickCapture.displayName = "QuickCapture";

export { QuickCapture, QuickCaptureSheet, type QuickCaptureSheetProps };
