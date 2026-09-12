import { Badge } from "@/components/atoms/badge";
import { INPUT_SM_CLASS } from "@/components/atoms/input";
import { MoneyInput } from "@/components/atoms/money-input";
import { Switcher } from "@/components/atoms/switcher";
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
    <li className="rounded-lg border border-line-hair bg-white p-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700">
          {position}
        </span>
        <input
          type="month"
          value={line.period}
          disabled={!editable}
          aria-label={`Line ${position} billing month`}
          aria-invalid={!periodOk || undefined}
          onChange={(event) => onChange(line.key, { period: event.target.value })}
          className={cn(INPUT_SM_CLASS, "min-w-0 flex-1")}
        />
        <div className="flex shrink-0 items-center gap-1.5">
          <MoneyInput
            value={line.percent}
            disabled={!editable}
            aria-label={`Line ${position} percent of stage value`}
            aria-invalid={!percentOk || undefined}
            onChange={(next) => onChange(line.key, { percent: next })}
            className="h-[38px] w-[76px] px-3"
          />
          <span className="text-sm font-medium text-ink-muted">%</span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 pl-8">
        <p className="min-w-0 truncate text-xs tabular-nums text-ink-muted">
          <span className="font-semibold text-ink">
            {formatCurrency(amount, currency)}
          </span>
          {` · ${formatPeriodLabel(line.period)}`}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {editable ? (
            <>
              <span className="text-xs font-medium uppercase text-ink-muted">
                Billed
              </span>
              <Switcher
                value={line.billed ? "yes" : "no"}
                onChange={(next) => onChange(line.key, { billed: next === "yes" })}
              />
              <button
                type="button"
                aria-label={`Remove line ${position}`}
                onClick={() => onRemove(line.key)}
                className="flex size-7 items-center justify-center rounded-md p-1.5 text-ink-muted outline-none transition-colors hover:bg-black/5 hover:text-ink focus-visible:shadow-focus"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  <path
                    d="M2.5 2.5l9 9m0-9l-9 9"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </>
          ) : (
            <Badge tone={line.billed ? "success" : "neutral"}>
              {line.billed ? "Billed" : "Not billed"}
            </Badge>
          )}
        </div>
      </div>
    </li>
  );
}

ScheduleLineRow.displayName = "ScheduleLineRow";
