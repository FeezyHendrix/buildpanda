import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";
import type { MediaItem } from "@/lib/project-types";

interface MediaLightboxProps {
  items: readonly MediaItem[];
  index: number | null;
  onOpenChange: (open: boolean) => void;
  onIndexChange: (index: number) => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.5;

function MediaLightbox({ items, index, onOpenChange, onIndexChange }: MediaLightboxProps) {
  const open = index !== null;
  const [zoom, setZoom] = useState(1);

  const active = index !== null ? items[index] : undefined;
  const hasPrev = index !== null && index > 0;
  const hasNext = index !== null && index < items.length - 1;

  useEffect(() => {
    setZoom(1);
  }, [index]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && index !== null && index > 0) onIndexChange(index - 1);
      if (e.key === "ArrowRight" && index !== null && index < items.length - 1) onIndexChange(index + 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, index, items.length, onIndexChange]);

  if (!active) return null;

  const isVideo = active.type === "video";
  const canZoom = !isVideo;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm" />
        <Dialog.Popup className="fixed inset-0 z-[70] flex flex-col outline-none">
          <header className="flex items-center justify-between gap-4 px-4 py-3 text-white">
            <span className="text-sm font-medium tabular-nums text-white/80">
              {(index ?? 0) + 1} / {items.length}
            </span>
            <div className="flex items-center gap-2">
              {canZoom && (
                <div className="flex items-center rounded-lg bg-white/10 p-0.5">
                  <button
                    type="button"
                    onClick={() => setZoom((v) => Math.max(MIN_ZOOM, Number((v - ZOOM_STEP).toFixed(2))))}
                    className="rounded-md px-2.5 py-1 text-sm font-medium text-white/90 hover:bg-white/15 disabled:opacity-40"
                    aria-label="Zoom out"
                    disabled={zoom <= MIN_ZOOM}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom(1)}
                    className="min-w-14 rounded-md px-2 py-1 text-sm font-medium tabular-nums text-white/90 hover:bg-white/15"
                    aria-label="Reset zoom"
                  >
                    {Math.round(zoom * 100)}%
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom((v) => Math.min(MAX_ZOOM, Number((v + ZOOM_STEP).toFixed(2))))}
                    className="rounded-md px-2.5 py-1 text-sm font-medium text-white/90 hover:bg-white/15 disabled:opacity-40"
                    aria-label="Zoom in"
                    disabled={zoom >= MAX_ZOOM}
                  >
                    +
                  </button>
                </div>
              )}
              <a
                href={active.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white/90 hover:bg-white/15"
              >
                Open in new tab
              </a>
              <Dialog.Close
                className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white/90 hover:bg-white/15"
                aria-label="Close"
              >
                Close
              </Dialog.Close>
            </div>
          </header>

          <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
            {hasPrev && (
              <button
                type="button"
                onClick={() => onIndexChange((index ?? 0) - 1)}
                className="absolute left-4 z-10 flex size-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                aria-label="Previous image"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
              </button>
            )}

            {isVideo ? (
              <video src={active.url} controls autoPlay className="max-h-full max-w-full rounded-lg" />
            ) : (
              <div className="flex size-full items-center justify-center overflow-auto">
                <img
                  src={active.url}
                  alt=""
                  className={cn(
                    "max-h-full max-w-full object-contain transition-transform duration-150 ease-out",
                    zoom > 1 ? "cursor-zoom-out" : "cursor-zoom-in",
                  )}
                  style={{ transform: `scale(${zoom})` }}
                  onClick={() =>
                    setZoom((v) => (v > 1 ? 1 : Math.min(MAX_ZOOM, 2)))
                  }
                />
              </div>
            )}

            {hasNext && (
              <button
                type="button"
                onClick={() => onIndexChange((index ?? 0) + 1)}
                className="absolute right-4 z-10 flex size-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                aria-label="Next image"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
              </button>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

MediaLightbox.displayName = "MediaLightbox";

export { MediaLightbox };
