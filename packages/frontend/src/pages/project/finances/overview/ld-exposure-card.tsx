import { Badge } from "@/components/atoms/badge";
import { Card } from "@/components/atoms/card";
import type { FinanceSummary } from "@/hooks/use-finances";
import { formatCurrency, formatShortDate } from "@/lib/formatters";

/**
 * Where the contract stands against its dates: the completion date the works
 * are measured against, the EOT days awarded and still claimed, and the
 * liquidated damages the employer could levy today.
 *
 * LD exposure is an EXPOSURE, not a debt — nothing is deducted anywhere, and a
 * pending EOT claim is not yet a defence, which is why the claimed days sit
 * next to it.
 */
interface LdExposureCardProps {
  summary: FinanceSummary;
}

function DateFigure({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-lg bg-surface-alt px-4 py-3">
      <p className="text-[13px] font-medium text-ink-muted">{label}</p>
      <p className="mt-1 text-sm font-medium text-ink">{value}</p>
      {helper ? <p className="mt-0.5 text-xs text-ink-muted">{helper}</p> : null}
    </div>
  );
}

DateFigure.displayName = "DateFigure";

export function LdExposureCard({ summary }: LdExposureCardProps) {
  const { ldExposure, eot } = summary;
  if (!summary.completionDate && !ldExposure && !eot) return null;

  const day = (iso: string | null) => (iso ? formatShortDate(iso) || iso : "Not set");

  return (
    <Card padding="lg">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl">
          <h3 className="text-sm font-semibold text-ink-muted">Contract dates &amp; liquidated damages</h3>
          <p className="mt-1 text-xs text-ink-muted">
            Lateness is measured against the revised completion date once an approved extension of
            time has moved it. LD exposure is what the employer could levy today — it is not
            deducted anywhere and nothing here is a debt.
          </p>
        </div>
        {ldExposure && ldExposure.amount > 0 ? (
          <Badge tone="danger" size="md" dot>
            {ldExposure.daysLate} {ldExposure.daysLate === 1 ? "day" : "days"} late
          </Badge>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DateFigure label="Completion date" value={day(summary.completionDate)} />
        <DateFigure
          label="Revised completion"
          value={day(summary.revisedCompletionDate)}
          helper={summary.revisedCompletionDate ? "Moved by an approved EOT" : "No EOT awarded"}
        />
        <DateFigure
          label="Extension of time"
          value={eot ? `${eot.daysApproved} awarded` : "—"}
          helper={eot && eot.daysPending > 0 ? `${eot.daysPending} days claimed, undecided` : undefined}
        />
        <DateFigure
          label="LD exposure"
          value={ldExposure ? formatCurrency(ldExposure.amount, summary.currency) : "—"}
          helper={
            ldExposure
              ? `${formatCurrency(ldExposure.ratePerDay, summary.currency)}/day against ${day(ldExposure.againstDate)}${
                  ldExposure.capAmount === null
                    ? ""
                    : ` · capped at ${formatCurrency(ldExposure.capAmount, summary.currency)}`
                }`
              : "No LD rate on the contract terms"
          }
        />
      </div>
    </Card>
  );
}

LdExposureCard.displayName = "LdExposureCard";
