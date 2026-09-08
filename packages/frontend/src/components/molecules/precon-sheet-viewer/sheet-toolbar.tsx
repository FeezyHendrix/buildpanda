import { Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PreconSheet } from "@/api/precon";
import { scaleRatioOf } from "@/lib/precon-meta";

export type PreconTool = "select" | "area" | "linear" | "count" | "deduct" | "scale";

export const TOOLS: { key: PreconTool; label: string; hint: string }[] = [
  { key: "select", label: "Select", hint: "Pan, zoom, pick measurements" },
  { key: "area", label: "Area m²", hint: "Redraw the selected item as a polygon" },
  { key: "linear", label: "Linear m", hint: "Redraw the selected item as a polyline" },
  { key: "count", label: "Count nr", hint: "Re-count the selected item with pins" },
  { key: "deduct", label: "Deduct", hint: "Draw an opening to subtract from the selected item" },
  { key: "scale", label: "Set scale", hint: "Click two points a known distance apart" },
];

interface Props {
  sheets: PreconSheet[];
  activeSheet: PreconSheet | null;
  onSelectSheet: (sheetId: string) => void;
  tool: PreconTool;
  onToolChange: (tool: PreconTool) => void;
  blockedReasonFor: (tool: PreconTool) => string | null;
  settingsOpen: boolean;
  onToggleSettings: () => void;
}

/** Sheet tabs, measuring tools, and the sheet-settings toggle above the canvas. */
export function SheetToolbar({ sheets, activeSheet, onSelectSheet, tool, onToolChange, blockedReasonFor, settingsOpen, onToggleSettings }: Props) {
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
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {TOOLS.map((t) => {
          const blocked = t.key === "select" ? null : blockedReasonFor(t.key);
          return (
            <button
              key={t.key}
              type="button"
              title={blocked ?? t.hint}
              disabled={Boolean(blocked)}
              onClick={() => onToolChange(t.key)}
              className={cn(
                "h-7 rounded-lg px-2.5 text-xs font-medium",
                tool === t.key ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100",
                blocked && "cursor-not-allowed opacity-40 hover:bg-transparent",
              )}
            >
              {t.label}
            </button>
          );
        })}
        <button
          type="button"
          title="Sheet type, title and scale"
          aria-pressed={settingsOpen}
          disabled={!activeSheet}
          onClick={onToggleSettings}
          className={cn(
            "ml-1 flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium",
            settingsOpen ? "bg-primary-50 text-primary-700" : "text-gray-600 hover:bg-gray-100",
            !activeSheet && "opacity-40",
          )}
        >
          <Settings2 className="size-3.5" aria-hidden="true" />
          Sheet
        </button>
      </div>
    </div>
  );
}
SheetToolbar.displayName = "SheetToolbar";
