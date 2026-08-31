import { ChevronLeft, ChevronRight, Lock, Maximize2, Minus, MoreHorizontal, Plus, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Sheet } from "./plan-review-data";
import { sheetAt } from "./plan-review-types";
import { IconBtn, POP_ITEM_CLS, PopShell } from "./plan-review-ui";
import { SheetImage } from "./plan-review-sheet-image";
export function SheetPane({
  paneKey,
  label,
  sheets,
  sheetIndex,
  zoom,
  locked,
  optionsOpen,
  onToggleOptions,
  onSheetChange,
  onZoomChange,
  onFit,
}: {
  paneKey: string;
  label: string;
  sheets: Sheet[];
  sheetIndex: number;
  zoom: number;
  locked: boolean;
  optionsOpen: boolean;
  onToggleOptions: () => void;
  onSheetChange: (index: number) => void;
  onZoomChange: (zoom: number) => void;
  onFit: () => void;
}) {
  const sheet = sheetAt(sheets, sheetIndex);
  const selectId = `${paneKey}-sheet-select`;
  return (
    <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#EDEDED] bg-white">
      <div className="flex items-center gap-2 border-b border-[#F0F0F0] px-3 py-2">
        <span className="rounded bg-[#F6F6F6] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
          {label}
        </span>
        <label htmlFor={selectId} className="sr-only">
          {label} pane sheet
        </label>
        <select
          id={selectId}
          value={sheetIndex}
          disabled={locked}
          onChange={(e) => onSheetChange(Number(e.target.value))}
          className="h-7 min-w-0 max-w-44 rounded-md bg-[#F6F6F6] px-2 text-xs font-medium text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sheets.map((s, i) => (
            <option key={s.id} value={i}>
              {s.code} · {s.title}
            </option>
          ))}
        </select>
        <IconBtn
          label={`${label} pane: previous sheet`}
          disabled={locked || sheetIndex === 0}
          onClick={() => onSheetChange(sheetIndex - 1)}
          className="size-7"
        >
          <ChevronLeft size={14} />
        </IconBtn>
        <IconBtn
          label={`${label} pane: next sheet`}
          disabled={locked || sheetIndex === sheets.length - 1}
          onClick={() => onSheetChange(sheetIndex + 1)}
          className="size-7"
        >
          <ChevronRight size={14} />
        </IconBtn>
        <span className="ml-auto text-[11px] text-gray-500">{sheet.revision}</span>
        <div className="relative">
          <IconBtn
            label={`${label} pane options`}
            onClick={onToggleOptions}
            expanded={optionsOpen}
            hasPopup
            className="size-7"
            data-popover-trigger
          >
            <MoreHorizontal size={14} />
          </IconBtn>
          {optionsOpen && (
            <PopShell className="right-0 w-44">
              <button type="button" onClick={onFit} className={POP_ITEM_CLS}>
                <Maximize2 size={14} /> Fit to pane
              </button>
              <button
                type="button"
                disabled
                title="Rotate (coming soon)"
                className={cn(POP_ITEM_CLS, "opacity-40 hover:bg-transparent")}
              >
                <RotateCcw size={14} /> Rotate
              </button>
            </PopShell>
          )}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-auto bg-[#F0F0F0] p-4">
        <div className="mx-auto w-fit min-w-full">
          <SheetImage
            sheet={sheet}
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top left" }}
            className="mx-auto w-full max-w-3xl rounded border border-[#E2E2E2] bg-white shadow-md"
          />
        </div>
        {locked && (
          <div className="pointer-events-none absolute inset-0 flex items-start justify-end bg-white/50 p-3">
            <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">
              <Lock size={11} /> Locked
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 border-t border-[#F0F0F0] px-3 py-1.5">
        <IconBtn
          label={`${label} pane: zoom out`}
          disabled={locked || zoom <= 50}
          onClick={() => onZoomChange(zoom - 10)}
          className="size-7"
        >
          <Minus size={13} />
        </IconBtn>
        <span className="w-11 text-center font-mono text-[11px] text-gray-600">{zoom}%</span>
        <IconBtn
          label={`${label} pane: zoom in`}
          disabled={locked || zoom >= 200}
          onClick={() => onZoomChange(zoom + 10)}
          className="size-7"
        >
          <Plus size={13} />
        </IconBtn>
      </div>
    </section>
  );
}
