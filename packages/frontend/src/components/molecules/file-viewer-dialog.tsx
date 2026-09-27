import { Dialog } from "@base-ui/react/dialog";
import { ArrowUpRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/atoms/badge";
import type { DocumentStatus } from "@/lib/project-types";

interface FileViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  fileName: string;
  url: string;
  status?: DocumentStatus | null;
  fileSize?: string | null;
}

function isImage(name: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(name);
}

function isPdf(name: string): boolean {
  return /\.pdf$/i.test(name);
}

function StatusPill({ status }: { status: DocumentStatus }) {
  if (status === "Verified")
    return (
      <Badge tone="success" size="sm">
        Verified
      </Badge>
    );
  if (status === "Expired")
    return (
      <Badge tone="danger" size="sm">
        Expired
      </Badge>
    );
  return (
    <Badge tone="neutral" variant="outline" size="sm">
      Pending
    </Badge>
  );
}

function FileViewerDialog({
  open,
  onOpenChange,
  title,
  fileName,
  url,
  status,
  fileSize,
}: FileViewerDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" />
        <Dialog.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-[60] flex h-[min(92vh,1100px)] w-[min(1200px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col",
            "overflow-hidden bg-white shadow-xl outline-none",
          )}
        >
          <header className="flex items-center justify-between gap-4 border-b border-[#EBEBEB] bg-white px-6 py-4">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <Dialog.Title className="truncate text-[15px] font-semibold text-[#1E1E1E]">
                  {title}
                </Dialog.Title>
                {status && <StatusPill status={status} />}
              </div>
              {fileSize && (
                <p className="mt-0.5 truncate text-xs text-[#9CA3AF]">{fileSize}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="flex h-10 items-center gap-1.5 border border-[#EBEBEB] bg-white px-4 text-[13px] font-medium text-[#1E1E1E] outline-none transition-colors hover:bg-[#F9FAFB]"
              >
                Open in new tab
                <ArrowUpRight className="size-4" />
              </a>
              <Dialog.Close
                aria-label="Close"
                className="flex size-10 items-center justify-center text-[#1E1E1E] outline-none transition-colors hover:bg-[#F5F5F5]"
              >
                <X className="size-5" />
              </Dialog.Close>
            </div>
          </header>

          <div className="flex-1 overflow-auto bg-white">
            {isImage(fileName) ? (
              <div className="flex min-h-full items-center justify-center p-4">
                <img
                  src={url}
                  alt={fileName}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : isPdf(fileName) ? (
              <iframe src={url} title={fileName} className="h-full w-full border-0" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                <p className="text-sm text-gray-500">
                  Preview isn&apos;t available for this file type.
                </p>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-[#004DE7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0041c4]"
                >
                  Open file
                </a>
              </div>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

FileViewerDialog.displayName = "FileViewerDialog";

export { FileViewerDialog };
