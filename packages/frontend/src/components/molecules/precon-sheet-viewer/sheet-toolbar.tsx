import { Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PreconSheet } from "@/api/precon";
import { scaleRatioOf } from "@/lib/precon-meta";

// The tool union now lives in lib/precon-meta.ts beside its palette meta; the
// viewer keeps re-exporting it from here so existing imports still resolve.
export type { PreconTool } from "@/lib/precon-meta";

interface Props {
  sheets: PreconSheet[];
  activeSheet: PreconSheet | null;
  onSelectSheet: (sheetId: string) => void;
  settingsOpen: boolean;
  onToggleSettings: () => void;
}

/** Sheet tabs and the sheet-settings toggle above the canvas; tools live in the palette. */
export function SheetToolbar({ sheets, activeSheet, onSelectSheet, settingsOpen, onToggleSettings }: Props) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-200 px-2 py-1.5">
      {sheets.map((sheet) => (
        <button
          key={sheet.id}
          type="button"
          onClick={() => onSelectSheet(sheet.id)}
          className={cn(
            "h-7 shrink-0 rounded-lg px-2.5 text-xs font-medium",
            sheet.id === activeSheet?.id ? "bg-primary-50 font-semibold text-primary-700" : "text-gray-600 hover:bg-gray-100",
            sheet.status === "unmeasurable" && "opacity-50",
          )}
          title={sheet.title ?? sheet.fileName}
        >
          {sheet.code ?? `p${sheet.pageNumber}`}
          {sheet.kind === "floor-plan" ? " · plan" : ""}
          {sheet.scaleMmPerPt ? ` · 1:${scaleRatioOf(sheet.scaleMmPerPt)}` : ""}
        </button>
      ))}
      <button
        type="button"
        title="Sheet type, title and scale"
        aria-pressed={settingsOpen}
        disabled={!activeSheet}
        onClick={onToggleSettings}
        className={cn(
          "ml-auto flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-medium",
          settingsOpen ? "bg-primary-50 text-primary-700" : "text-gray-600 hover:bg-gray-100",
          !activeSheet && "opacity-40",
        )}
      >
        <Settings2 className="size-3.5" aria-hidden="true" />
        Sheet
      </button>
    </div>
  );
}
SheetToolbar.displayName = "SheetToolbar";
