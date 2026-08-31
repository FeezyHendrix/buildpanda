import { Columns2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Sheet } from "./plan-review-data";
import { BLEND_MODE, BLEND_MODES, type BlendMode } from "./plan-review-types";
import { IconBtn } from "./plan-review-ui";

export function BlendComparisonPanel({
  blendMode,
  amount,
  sheets,
  sheetCode,
  revision,
  compareIndex,
  blendReady,
  onModeChange,
  onAmountChange,
  onCompareIndexChange,
  onReset,
  onOpenSplit,
  onClose,
}: {
  blendMode: BlendMode | null;
  amount: number;
  sheets: Sheet[];
  sheetCode: string;
  revision: string;
  compareIndex: number;
  blendReady: boolean;
  onModeChange: (mode: BlendMode) => void;
  onAmountChange: (amount: number) => void;
  onCompareIndexChange: (index: number) => void;
  onReset: () => void;
  onOpenSplit: () => void;
  onClose: () => void;
}) {
  return (
            <div className="z-30 w-full border-t border-[#EDEDED] bg-white p-3 md:absolute md:bottom-4 md:left-1/2 md:w-[560px] md:max-w-[calc(100%-2rem)] md:-translate-x-1/2 md:rounded-2xl md:border md:shadow-xl md:ring-1 md:ring-black/5">
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-[#EDEDED] bg-[#F6F6F6] p-0.5" role="group" aria-label="Blend mode">
                  {BLEND_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      aria-pressed={mode.id === blendMode}
                      onClick={() => onModeChange(mode.id)}
                      className={cn(
                        "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                        mode.id === blendMode ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900",
                      )}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={onOpenSplit}
                  className="flex items-center gap-1.5 rounded-lg border border-[#EDEDED] px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-[#F6F6F6] hover:text-gray-900"
                >
                  <Columns2 size={13} /> Split View
                </button>
                <IconBtn
                  label="Close comparison panel"
                  onClick={onClose}
                  className="ml-auto"
                >
                  <X size={15} />
                </IconBtn>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-gray-700">
                  {sheetCode} · {revision}
                  <span className="px-1.5 text-gray-400">vs</span>
                  <label htmlFor="compare-sheet" className="sr-only">
                    Comparison sheet
                  </label>
                  <select
                    id="compare-sheet"
                    value={compareIndex}
                    onChange={(e) => onCompareIndexChange(Number(e.target.value))}
                    className="rounded-md bg-[#F6F6F6] px-1.5 py-1 text-xs text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
                  >
                    {sheets.map((s, i) => (
                      <option key={s.id} value={i}>
                        {s.code} · {s.revision}
                      </option>
                    ))}
                  </select>
                </span>
                <button
                  type="button"
                  onClick={onReset}
                  className="rounded-md px-2 py-1 font-medium text-primary-600 hover:bg-[#F6F6F6]"
                >
                  Reset
                </button>
              </div>

              {!blendReady && blendMode && (
                <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700">
                  Overlay comparison needs two image sheets — PDF and CAD files can be compared side by side in Split View.
                </p>
              )}

              <div className="mt-2">
                <div className="flex items-center justify-between text-[11px] text-gray-500">
                  <span>
                    {blendMode === BLEND_MODE.GHOST ? "Ghost opacity" : blendMode === BLEND_MODE.HIGHLIGHT ? "Highlight intensity" : "Revision overlay"}
                  </span>
                  <span className="font-mono text-gray-700">{amount}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={amount}
                  aria-label="Blend amount"
                  aria-valuetext={`${amount} percent overlay`}
                  onChange={(e) => onAmountChange(Number(e.target.value))}
                  className="mt-1 w-full accent-primary-600"
                />
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>Original</span>
                  <span>Overlay</span>
                </div>
              </div>
            </div>
  );
}

BlendComparisonPanel.displayName = "BlendComparisonPanel";
