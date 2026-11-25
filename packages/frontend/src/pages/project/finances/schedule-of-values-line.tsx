import { Badge } from "@/components/atoms/badge";
import { X } from "lucide-react";
import { MoneyInput } from "@/components/atoms/money-input";
import { ToggleSwitch } from "@/components/atoms/toggle-switch";
import type { StageScheduleOfValue } from "@/hooks/use-stages";
import { formatCurrency } from "@/lib/formatters";
import { Money } from "@/lib/money";
import type { Currency } from "@/lib/project-types";
import { cn } from "@/lib/utils";

/**
 * One editable Schedule of Values line — a billing month, its share of the
 * stage value, and whether that share has already been billed — plus the pure
 * period/percent helpers the editor drives it with.
 */

export interface DraftLine {
  key: string;
  period: string;
  percent: string;
  billed: boolean;
}

export const MAX_PERCENT = 100;

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Client-side row identity: periods can repeat or sit blank mid-edit. */
let lineSeq = 0;
export function nextLineKey(): string {
  lineSeq += 1;
  return `sov-line-${lineSeq}`;
}

export function isValidPeriod(period: string): boolean {
  return PERIOD_PATTERN.test(period);
}

/** `null` for anything that is not a usable 0–100 percentage. */
export function parsePercent(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_PERCENT) return null;
  return parsed;
}

export function percentOrZero(raw: string): number {
  return parsePercent(raw) ?? 0;
}

export function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-03" -> "2026-04", rolling the year over at December. */
export function nextPeriod(period: string): string {
  if (!isValidPeriod(period)) return currentPeriod();
  const [yearPart, monthPart] = period.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return currentPeriod();
  const rolls = month === 12;
  const nextMonth = rolls ? 1 : month + 1;
  return `${rolls ? year + 1 : year}-${String(nextMonth).padStart(2, "0")}`;
}

/** "2026-03" -> "Mar 2026"; a prompt back when it isn't a real month yet. */
export function formatPeriodLabel(period: string): string {
  if (!isValidPeriod(period)) return "Pick a month";
  const date = new Date(`${period}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return period;
  return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

/**
 * Line amounts, computed exactly the way the backend computes them
 * (modules/stages/service.ts): value the whole scheduled slice once, then split
 * it by the largest-remainder method so the lines add back up to the cent.
 */
export function allocateLineAmounts(
  stageValue: number,
  percents: number[],
): Money[] {
  return Money.of(stageValue).percent(Money.sum(percents)).allocate(percents);
}

export function toDraftLine(row: StageScheduleOfValue): DraftLine {
  return {
    key: nextLineKey(),
    period: row.period,
    percent: Money.of(row.percent).toString(),
    billed: row.billed,
  };
}

interface ScheduleLineRowProps {
  line: DraftLine;
  index: number;
  amount: number;
  currency: Currency;
  editable: boolean;
  onChange: (key: string, patch: Partial<Omit<DraftLine, "key">>) => void;
  onRemove: (key: string) => void;
}

const LINE_FIELD =
  "h-[45px] border border-[#EEEEEE] bg-white text-caption-l text-[#1E1E1E] outline-none focus:border-[#004DE7] disabled:bg-[#FAFAFA] disabled:text-[#737373] aria-[invalid=true]:border-[#E7000B]";

export function ScheduleLineRow({
  line,
  index,
  amount,
  currency,
  editable,
  onChange,
  onRemove,
}: ScheduleLineRowProps) {
  const periodOk = isValidPeriod(line.period);
  const percentOk = parsePercent(line.percent) !== null;
  const position = index + 1;

  return (
    <li className="relative border border-[#EEEEEE] bg-white px-[24px] pb-[22px] pt-[50px]">
      {editable ? (
        <button
          type="button"
          aria-label={`Remove line ${position}`}
          onClick={() => onRemove(line.key)}
          className="absolute right-[34px] top-[26px] flex size-[20px] items-center justify-center text-[#1E1E1E] outline-none hover:text-[#E7000B] focus-visible:ring-2 focus-visible:ring-[#004DE7]/25"
        >
          <X className="size-[20px]" strokeWidth={1.5} aria-hidden />
        </button>
      ) : null}

      <label htmlFor={`${line.key}-month`} className="text-caption-m font-semibold text-[#1E1E1E]">
        Date
      </label>
      <div className="mt-[4px] flex items-center gap-[10px]">
        <input
          id={`${line.key}-month`}
          type="month"
          value={line.period}
          disabled={!editable}
          aria-invalid={!periodOk || undefined}
          onChange={(event) => onChange(line.key, { period: event.target.value })}
          className={cn(LINE_FIELD, "min-w-0 flex-1 px-[16px]")}
        />
        <MoneyInput
          value={line.percent}
          disabled={!editable}
          aria-label={`Line ${position} percent of stage value`}
          aria-invalid={!percentOk || undefined}
          onChange={(next) => onChange(line.key, { percent: next })}
          className={cn(LINE_FIELD, "w-[56px] rounded-none px-0 text-center lg:text-caption-l")}
        />
        <span className="text-caption-l font-medium text-[#1E1E1E]">%</span>
      </div>

      <div className="mt-[16px] flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-caption-l tabular-nums text-[#737373]">
          <span className="font-medium text-[#1E1E1E]">{formatCurrency(amount, currency)}</span>
          {` · ${formatPeriodLabel(line.period)}`}
        </p>
        {editable ? (
          <div className="flex shrink-0 items-center gap-[10px]">
            <span className="text-caption-l font-medium text-[#1E1E1E]">Billed</span>
            <ToggleSwitch
              size="sm"
              checked={line.billed}
              onChange={(next) => onChange(line.key, { billed: next })}
              ariaLabel={`Line ${position} billed`}
              className="h-[20px] w-[34px]"
            />
          </div>
        ) : (
          <Badge tone={line.billed ? "success" : "neutral"}>{line.billed ? "Billed" : "Not billed"}</Badge>
        )}
      </div>
    </li>
  );
}

ScheduleLineRow.displayName = "ScheduleLineRow";
