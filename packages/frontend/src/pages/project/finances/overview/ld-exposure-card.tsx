import type { FinanceSummary } from "@/hooks/use-finances";
import { formatCurrency, formatShortDate } from "@/lib/formatters";
import { OverviewCard, OverviewList, OverviewRow } from "./overview-cards";

/**
 * Where the contract stands against its dates, read from
 * `GET /finances/summary`: the completion date and any revised date come from
 * the programme's key dates, the EOT figures from the extension-of-time claims
 * recorded on the contract, and LD exposure is the backend's days-late times
 * the LD rate on the contract terms, capped where the terms cap it.
 *
 * LD exposure is an EXPOSURE, not a debt. Nothing is deducted anywhere, and a
 * pending EOT claim is not yet a defence, which is why the claimed days sit
 * next to it.
 */
interface LdExposureCardProps {
  summary: FinanceSummary;
  contractsHref: string;
  className?: string;
}

function dayLabel(days: number): string {
  return `${days} ${days === 1 ? "day" : "days"}`;
}

export function LdExposureCard({ summary, contractsHref, className }: LdExposureCardProps) {
  const { ldExposure, eot } = summary;
  if (!summary.completionDate && !ldExposure && !eot) return null;

  const day = (iso: string | null) => (iso ? formatShortDate(iso) || iso : "Not set");
  const money = (value: number) => formatCurrency(value, summary.currency);

  return (
    <OverviewCard title="Dates & liquidated damages" to={contractsHref} linkLabel="Contract terms" className={className}>
      <OverviewList>
        <OverviewRow label="Completion date" value={day(summary.completionDate)} />
        <OverviewRow
          label="Revised completion"
          value={day(summary.revisedCompletionDate)}
          helper={summary.revisedCompletionDate ? "Moved by an approved EOT" : "No EOT awarded"}
        />
        <OverviewRow
          label="Extension of time"
          value={eot ? `${dayLabel(eot.daysApproved)} awarded` : "None"}
          helper={eot && eot.daysPending > 0 ? `${dayLabel(eot.daysPending)} claimed, undecided` : undefined}
        />
        <OverviewRow
          label="LD exposure"
          sub="What the employer could levy today. Nothing is deducted."
          value={ldExposure ? money(ldExposure.amount) : "None"}
          helper={
            ldExposure
              ? `${dayLabel(ldExposure.daysLate)} late at ${money(ldExposure.ratePerDay)} a day${
                  ldExposure.capAmount === null ? "" : `, capped at ${money(ldExposure.capAmount)}`
                }`
              : "No LD rate on the contract terms"
          }
        />
      </OverviewList>
    </OverviewCard>
  );
}

LdExposureCard.displayName = "LdExposureCard";
