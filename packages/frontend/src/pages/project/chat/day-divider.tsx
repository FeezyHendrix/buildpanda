import { formatDayHeading } from "@/lib/formatters";

/** Bubbles carry only the time, so each new day is announced above its first message. */
export function DayDivider({ iso }: { iso: string }) {
  return (
    <div role="separator" className="flex items-center gap-[12px] px-[16px] pt-[10px]">
      <span className="h-px flex-1 bg-[#EEEEEE]" />
      <span className="text-[12px] leading-[16px] text-[#737373]">{formatDayHeading(iso)}</span>
      <span className="h-px flex-1 bg-[#EEEEEE]" />
    </div>
  );
}

DayDivider.displayName = "DayDivider";
