import { FileText, ImageOff } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { SHEET_KIND, type Sheet } from "./plan-review-data";
import { PdfSheetCanvas } from "./plan-review-pdf";
export function SheetImage({
  sheet,
  className,
  style,
  pageNumber = 1,
  onRender,
}: {
  sheet: Sheet;
  className?: string;
  style?: React.CSSProperties;
  pageNumber?: number;
  onRender?: (state: {
    aspect: number;
    detectedScale: { label: string; feetPerPct: number } | null;
    pageCount?: number;
  }) => void;
}) {
  if (sheet.kind === SHEET_KIND.IMAGE && sheet.src) {
    return <ImageSheet sheet={sheet} className={className} style={style} onRender={onRender} />;
  }
  if (sheet.kind === SHEET_KIND.PDF && sheet.src) {
    return (
      <PdfSheetCanvas
        url={sheet.src}
        title={sheet.alt}
        className={className}
        pageNumber={pageNumber}
        onRenderStateChange={(state) =>
          onRender?.({
            aspect: state.aspect,
            detectedScale: state.detectedScale,
            pageCount: state.pageCount,
          })
        }
      />
    );
  }
  return (
    <div
      className={cn("flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 text-center", className)}
      style={style}
      role="img"
      aria-label={sheet.alt}
    >
      <FileText size={28} className="text-gray-300" />
      <p className="max-w-[80%] truncate text-sm font-medium text-gray-600">{sheet.title}</p>
      <p className="text-xs text-gray-400">Preview isn&apos;t available for this file type — annotate on the placeholder.</p>
    </div>
  );
}

/**
 * A drawing that will not load is a state the reviewer has to see: a browser's
 * broken-image icon says nothing about whether the file is gone, the storage is
 * down, or the network dropped, and leaves no way to try again.
 */
function ImageSheet({
  sheet,
  className,
  style,
  onRender,
}: {
  sheet: Sheet;
  className?: string;
  style?: React.CSSProperties;
  onRender?: (state: { aspect: number; detectedScale: null }) => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    setAttempt(0);
  }, [sheet.src]);

  if (failed) {
    return (
      <div
        className={cn(
          "flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 p-6 text-center",
          className,
        )}
        style={style}
        role="img"
        aria-label={`${sheet.alt} — could not be loaded`}
      >
        <ImageOff size={28} className="text-gray-300" />
        <p className="max-w-[80%] truncate text-sm font-medium text-gray-600">{sheet.title}</p>
        <p className="max-w-[36ch] text-xs text-gray-400">
          This drawing could not be loaded. The file store may be unavailable — markups are safe.
        </p>
        <button
          type="button"
          onClick={() => {
            setFailed(false);
            setAttempt((value) => value + 1);
          }}
          className="mt-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-primary-500 hover:bg-gray-100"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <img
      // A changing key retries a src the browser has already cached as failed.
      key={attempt}
      src={attempt === 0 ? sheet.src! : `${sheet.src!}${sheet.src!.includes("?") ? "&" : "?"}retry=${attempt}`}
      alt={sheet.alt}
      draggable={false}
      className={className}
      style={style}
      onError={() => setFailed(true)}
      onLoad={(e) => {
        const el = e.currentTarget;
        if (el.naturalWidth > 0) {
          onRender?.({ aspect: el.naturalHeight / el.naturalWidth, detectedScale: null });
        }
      }}
    />
  );
}
