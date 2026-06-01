import { Dialog } from "@base-ui-components/react/dialog";
import { cn } from "@/lib/utils";

interface FileViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  fileName: string;
  url: string;
}

function isImage(name: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(name);
}

function isPdf(name: string): boolean {
  return /\.pdf$/i.test(name);
}

function FileViewerDialog({
  open,
  onOpenChange,
  title,
  fileName,
  url,
}: FileViewerDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" />
        <Dialog.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-[60] flex h-[min(85vh,900px)] w-[min(960px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col",
            "overflow-hidden rounded-2xl bg-white shadow-xl outline-none",
          )}
        >
          <header className="flex items-center justify-between gap-4 border-b border-[#F0F0F0] px-5 py-3.5">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-sm font-semibold text-gray-900">
                {title}
              </Dialog.Title>
              <p className="truncate text-xs text-gray-500">{fileName}</p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-[#F6F6F6] px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
              >
                Open in new tab
              </a>
              <Dialog.Close className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-[#F6F6F6] hover:text-gray-900">
                Close
              </Dialog.Close>
            </div>
          </header>

          <div className="flex-1 overflow-auto bg-[#FAFAFA]">
            {isImage(fileName) ? (
              <div className="flex h-full items-center justify-center p-4">
                <img src={url} alt={fileName} className="max-h-full max-w-full object-contain" />
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
