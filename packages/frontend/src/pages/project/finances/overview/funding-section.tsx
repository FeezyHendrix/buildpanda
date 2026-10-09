import type { FundingPosition } from "@/hooks/use-finances";
import { BUDGET_INVOICES_PATH, financeTabPath } from "@/lib/finance-routes";
import { formatCurrency } from "@/lib/formatters";
import { OverviewCard, OverviewList, OverviewRow } from "./overview-cards";

/**
 * Funding: money the client has put into the project and what has been
 * released against stage milestones. This is NOT certification: it is a
 * separate ledger, it never feeds the contract position, and a QS reading
 * "certified" or "paid" on this page is reading the certificates, not these
 * figures. Everything here logs a movement made off-platform; the "Record
 * funding" action lives in the page header and the trail in its own card.
 */
interface FundingCardProps {
  projectId: string;
  currency: string;
  funding: FundingPosition;
  className?: string;
}

export function FundingCard({ projectId, currency, funding, className }: FundingCardProps) {
  return (
    <OverviewCard title="Funding" to={`/project/${projectId}/${financeTabPath(BUDGET_INVOICES_PATH, "payments")}`} className={className}>
      <OverviewList>
        <OverviewRow label="Funds deposited" sub="Recorded client deposits" value={formatCurrency(funding.deposited, currency)} />
        <OverviewRow label="Milestones released" sub="Stage payments logged as released" value={formatCurrency(funding.released, currency)} />
      </OverviewList>
      <p className="mt-2 text-xs text-ink-muted">A separate ledger. Deposits and releases never feed the contract position.</p>
    </OverviewCard>
  );
}

FundingCard.displayName = "FundingCard";
