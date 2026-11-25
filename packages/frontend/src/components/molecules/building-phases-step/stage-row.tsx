import { X } from "lucide-react";
import { DateInputField } from "@/components/molecules/date-input-field";
import { cn } from "@/lib/utils";
import type { StageDraft } from "./phase-draft";

/** Column grid shared by the heading labels and every stage row. */
export const STAGE_GRID = "grid grid-cols-[minmax(0,261fr)_minmax(0,166fr)_minmax(0,166fr)] gap-x-[16px]";

const DATE_CLASS = "h-[45px] border border-[#EEEEEE] bg-white px-[16px] text-[14px] font-medium";

/** One stage: its name, when it starts and when it should finish. */
export function StageRow({
  stage,
  onChange,
  onRemove,
}: {
  stage: StageDraft;
  onChange: (patch: Partial<StageDraft>) => void;
  onRemove: () => void;
}) {
  return (
    <div className={STAGE_GRID}>
      <div className="group relative">
        <input
          value={stage.name}
          onChange={(e) => onChange({ name: e.target.value })}
          aria-label="Build stage name"
          maxLength={80}
          className={cn(
            "h-[45px] w-full bg-white pl-[16px] pr-[40px] text-[14px] font-medium text-[#1E1E1E] outline-none transition-colors",
            "placeholder:text-[#B0B0B0] focus:border-[#1E1E1E]",
            stage.name ? "border border-[#7A7A7A]" : "border border-[#EEEEEE]",
          )}
          placeholder="Stage name"
        />
        <button
          type="button"
          aria-label={`Remove ${stage.name || "this stage"}`}
          onClick={onRemove}
          className="absolute right-[10px] top-1/2 flex size-[24px] -translate-y-1/2 items-center justify-center text-[#737373] opacity-0 outline-none hover:text-[#C10007] focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-gray-900/10 group-focus-within:opacity-100 group-hover:opacity-100"
        >
          <X className="size-[16px]" strokeWidth={1.5} aria-hidden />
        </button>
      </div>
      <DateInputField
        aria-label="Start date"
        value={stage.startDate}
        max={stage.targetDate || undefined}
        onChange={(startDate) => onChange({ startDate })}
        className={cn(DATE_CLASS, stage.startDate ? "text-[#1E1E1E]" : "text-[#B0B0B0]")}
      />
      <DateInputField
        aria-label="Target date"
        value={stage.targetDate}
        min={stage.startDate || undefined}
        onChange={(targetDate) => onChange({ targetDate })}
        className={cn(DATE_CLASS, stage.targetDate ? "text-[#1E1E1E]" : "text-[#B0B0B0]")}
      />
    </div>
  );
}

StageRow.displayName = "StageRow";
