import { FileText } from "lucide-react";
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
    return (
      <img
        src={sheet.src}
        alt={sheet.alt}
        draggable={false}
        className={className}
        style={style}
        onLoad={(e) => {
          const el = e.currentTarget;
          if (el.naturalWidth > 0) {
            onRender?.({ aspect: el.naturalHeight / el.naturalWidth, detectedScale: null });
          }
        }}
      />
    );
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
