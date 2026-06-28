import { Button } from "@/components/atoms/button";
import { cn } from "@/lib/utils";
import {
  type InvoiceTotals,
  type UpsertInvoiceValues,
} from "./invoice-form-model";

interface TotalsCardProps {
  values: UpsertInvoiceValues;
  totals: InvoiceTotals;
  money: (n: number) => string;
  isValid: boolean;
  submitting: boolean;
  error: string | null;
  validLineCount: number;
  onCancel: () => void;
}

export function TotalsCard({
  values,
  totals,
  money,
  isValid,
  submitting,
  error,
  validLineCount,
  onCancel,
}: TotalsCardProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-primary-100 bg-white shadow-sm">
      <div className="bg-gradient-to-br from-primary-50 to-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-700">
          Net payable
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-primary-900">
          {money(totals.netPayable)}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          {validLineCount} valid{" "}
          {validLineCount === 1 ? "line item" : "line items"}
        </p>
      </div>

      <dl className="flex flex-col gap-1.5 px-5 py-4 text-sm">
        <Row label="Subtotal" value={money(totals.subtotal)} />
        <Row label={`VAT (${values.vatRate || "0"}%)`} value={money(totals.vat)} />
        <Row label="Total invoiced" value={money(totals.totalInvoiced)} strong />
        <Row
          label={`WHT (${values.whtRate || "0"}%)`}
          value={`− ${money(totals.wht)}`}
          muted
        />
        <Row
          label={`Retention (${values.retentionRate || "0"}%)`}
          value={`− ${money(totals.retention)}`}
          muted
        />
      </dl>

      <div className="border-t border-[#F0F0F0] px-5 py-4">
        {error ? (
          <p className="mb-3 rounded-lg bg-error-50 px-3 py-2 text-xs text-error-700">
            {error}
          </p>
        ) : null}
        <div className="hidden flex-col gap-2 lg:flex">
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={!isValid}
            loading={submitting}
            className="w-full"
          >
            Create invoice
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={onCancel}
            className="w-full"
          >
            Cancel
          </Button>
          {!isValid ? (
            <p className="mt-1 text-[11px] text-gray-500">
              Add a vendor and at least one line with a rate to create.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface RowProps {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}

function Row({ label, value, strong, muted }: RowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between",
        strong && "font-semibold text-gray-900",
        muted && "text-gray-500",
      )}
    >
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
