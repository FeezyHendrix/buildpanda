import { MoneyInput } from "@/components/atoms/money-input";
import type { PayApplicationLine } from "@/hooks/use-invoices";
import { formatCurrency } from "@/lib/formatters";
import { Money } from "@/lib/money";
import type { Currency } from "@/lib/project-types";
import { cn } from "@/lib/utils";

/**
 * One editable pay-application line — an AIA G703 row for a single build stage
 * — plus the pure helpers the editor drives it with.
 *
 * The user types three figures per stage: what was completed THIS PERIOD, the
 * materials PRESENTLY STORED, and the amount RETAINED. Everything else on the
 * row is derived, exactly the way the backend derives it
 * (modules/invoices/pay-application.ts), so the preview matches the saved
 * result to the cent:
 *
 *   totalCompleted    = priorBilled + thisPeriod + storedMaterials
 *   balanceToFinish   = scheduledValue - totalCompleted
 *   currentPaymentDue = thisPeriod + storedMaterials - retained
 *
 * `priorBilled` ("billed in previous applications") is derived server-side from
 * every OTHER application on the stage, so it is read-only here.
 *
 * These are RECORDED figures. BuildPanda logs money movements that happened
 * off-platform; nothing on this row charges, collects or moves anything.
 */

export interface DraftPayLine {
  key: string;
  stageId: string;
  stageName: string;
  /** The stage's contract value. Read-only — it lives on the stage. */
  scheduledValue: number;
  /** Billed in previous applications. Read-only — the backend derives it. */
  priorBilled: number;
  /** Stage just added: its prior billing lives on other invoices, so it is only known after save. */
  pendingPrior: boolean;
  thisPeriod: string;
  storedMaterials: string;
  retained: string;
}

export interface LineTotals {
  totalCompleted: Money;
  balanceToFinish: Money;
  currentPaymentDue: Money;
  /** The backend rejects the whole application when this is true. */
  overBilled: boolean;
  overBy: Money;
}

const FIELD_LABEL =
  "text-[10px] font-semibold uppercase tracking-wider text-black-200";

/** Client-side row identity: a stage can be swapped out mid-edit. */
let payLineSeq = 0;
export function nextPayLineKey(): string {
  payLineSeq += 1;
  return `pay-line-${payLineSeq}`;
}

/** `null` for anything that is not a usable non-negative amount; "" is zero. */
export function parseAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return 0;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export function amountOrZero(raw: string): number {
  return parseAmount(raw) ?? 0;
}

export function isValidLine(line: DraftPayLine): boolean {
  return (
    parseAmount(line.thisPeriod) !== null &&
    parseAmount(line.storedMaterials) !== null &&
    parseAmount(line.retained) !== null
  );
}

/** An amount as a lean editable string: 1200, 1200.5 — never 1,200.00. */
export function toAmountField(value: number): string {
  return value === 0 ? "" : Money.of(value).toString();
}

export function toDraftPayLine(
  row: PayApplicationLine,
  scheduledValue: number,
): DraftPayLine {
  return {
    key: nextPayLineKey(),
    stageId: row.stageId,
    stageName: row.stageName,
    scheduledValue,
    priorBilled: row.priorBilled,
    pendingPrior: false,
    thisPeriod: toAmountField(row.thisPeriod),
    storedMaterials: toAmountField(row.storedMaterials),
    retained: toAmountField(row.retained),
  };
}

/**
 * The backend's per-line arithmetic, run on the draft. Every figure is rounded
 * to 2 dp the way the service rounds it before it is summed, so the drawer's
 * totals and the saved summary agree exactly.
 */
export function lineTotals(line: DraftPayLine): LineTotals {
  const thisPeriod = Money.of(amountOrZero(line.thisPeriod));
  const stored = Money.of(amountOrZero(line.storedMaterials));
  const retained = Money.of(amountOrZero(line.retained));
  const scheduled = Money.of(line.scheduledValue);

  const totalCompleted = Money.of(line.priorBilled)
    .add(thisPeriod)
    .add(stored)
    .round(2);

  return {
    totalCompleted,
    balanceToFinish: scheduled.sub(totalCompleted).round(2),
    currentPaymentDue: thisPeriod.add(stored).sub(retained).round(2),
    overBilled: totalCompleted.gt(scheduled),
    overBy: totalCompleted.sub(scheduled).round(2),
  };
}

interface AmountFieldProps {
  label: string;
  value: string;
  rowLabel: string;
  editable: boolean;
  invalid: boolean;
  onChange: (next: string) => void;
}

function AmountField({
  label,
  value,
  rowLabel,
  editable,
  invalid,
  onChange,
}: AmountFieldProps) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className={FIELD_LABEL}>{label}</span>
      <MoneyInput
        value={value}
        disabled={!editable}
        aria-label={`${rowLabel} ${label.toLowerCase()}`}
        onChange={onChange}
        className={cn("h-10 px-3", invalid && "ring-2 ring-error-300")}
      />
    </label>
  );
}

AmountField.displayName = "AmountField";

interface ReadOutProps {
  label: string;
  value: string;
  tone?: "default" | "due" | "error";
}

function ReadOut({ label, value, tone = "default" }: ReadOutProps) {
  return (
    <div className="min-w-0">
      <p className={FIELD_LABEL}>{label}</p>
      <p
        className={cn(
          "mt-0.5 truncate text-sm font-semibold tabular-nums",
          tone === "due"
            ? "text-primary-500"
            : tone === "error"
              ? "text-error-600"
              : "text-black-500",
        )}
      >
        {value}
      </p>
    </div>
  );
}

ReadOut.displayName = "ReadOut";

interface PayApplicationLineRowProps {
  line: DraftPayLine;
  index: number;
  totals: LineTotals;
  currency: Currency;
  editable: boolean;
  onChange: (key: string, patch: Partial<Omit<DraftPayLine, "key">>) => void;
  onRemove: (key: string) => void;
}

export function PayApplicationLineRow({
  line,
  index,
  totals,
  currency,
  editable,
  onChange,
  onRemove,
}: PayApplicationLineRowProps) {
  const position = index + 1;
  const rowLabel = `${line.stageName || "Stage"} —`;

  return (
    <li
      className={cn(
        "rounded-xl border bg-white p-3",
        totals.overBilled ? "border-error-300" : "border-grey-50",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[11px] font-semibold text-primary-700">
            {position}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-black-500">
              {line.stageName || "Untitled stage"}
            </p>
            <p className="mt-0.5 text-[11px] tabular-nums text-black-300">
              {formatCurrency(line.scheduledValue, currency)} scheduled ·{" "}
              {line.pendingPrior
                ? "previous applications confirmed on save"
                : `${formatCurrency(line.priorBilled, currency)} in previous applications`}
            </p>
          </div>
        </div>
        {editable ? (
          <button
            type="button"
            aria-label={`Remove ${line.stageName || "stage"} from this application`}
            onClick={() => onRemove(line.key)}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-black-200 outline-none transition-colors hover:bg-error-50 hover:text-error-600 focus-visible:ring-2 focus-visible:ring-gray-900/10"
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
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <AmountField
          label="This period"
          value={line.thisPeriod}
          rowLabel={rowLabel}
          editable={editable}
          invalid={parseAmount(line.thisPeriod) === null}
          onChange={(next) => onChange(line.key, { thisPeriod: next })}
        />
        <AmountField
          label="Stored materials"
          value={line.storedMaterials}
          rowLabel={rowLabel}
          editable={editable}
          invalid={parseAmount(line.storedMaterials) === null}
          onChange={(next) => onChange(line.key, { storedMaterials: next })}
        />
        <AmountField
          label="Retained"
          value={line.retained}
          rowLabel={rowLabel}
          editable={editable}
          invalid={parseAmount(line.retained) === null}
          onChange={(next) => onChange(line.key, { retained: next })}
        />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-grey-50 pt-2.5">
        <ReadOut
          label="Completed & stored"
          value={formatCurrency(totals.totalCompleted.toNumber(), currency)}
          tone={totals.overBilled ? "error" : "default"}
        />
        <ReadOut
          label="Balance to finish"
          value={formatCurrency(totals.balanceToFinish.toNumber(), currency)}
          tone={totals.balanceToFinish.isNegative() ? "error" : "default"}
        />
        <ReadOut
          label="Current due"
          value={formatCurrency(totals.currentPaymentDue.toNumber(), currency)}
          tone="due"
        />
      </div>

      {totals.overBilled ? (
        <p className="mt-2 rounded-lg bg-error-50 px-3 py-2 text-xs font-medium text-error-600">
          Over the scheduled value by{" "}
          {formatCurrency(totals.overBy.toNumber(), currency)}. A stage cannot be
          billed past its contract value — trim this period or stored materials
          before saving.
        </p>
      ) : null}
    </li>
  );
}

PayApplicationLineRow.displayName = "PayApplicationLineRow";
