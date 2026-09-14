import { Link } from "react-router-dom";
import { Badge } from "@/components/atoms/badge";
import { Card } from "@/components/atoms/card";
import { Spinner } from "@/components/atoms/spinner";
import { FinancesIcon } from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { PageHeader } from "@/components/molecules/page-header";
import { useFinancePosition } from "@/hooks/use-finances";
import { useProjectContext } from "@/layouts/project-layout";
import { CONTRACTS_PHASES_PATH } from "@/lib/finance-routes";
import { canResourceAction } from "@/lib/project-types";
import { MoneyStrip } from "./finances/money-strip";
import { ChangeOrdersCard } from "./finances/overview/change-orders-card";
import { FundingSection } from "./finances/overview/funding-section";
import { LdExposureCard } from "./finances/overview/ld-exposure-card";
import { PhaseVarianceCard } from "./finances/overview/phase-variance-card";
import { RecentInvoicesCard } from "./finances/overview/recent-invoices-card";
import { SettlementStatement, isSettled } from "./finances/settlement-statement";

/**
 * Finance overview — one screen, one money model. The waterfall and the KPI
 * strip both read `GET /projects/:id/finances/summary` and recompute nothing:
 * certification comes from approved receivable certificates, payment from the
 * receipts recorded on them. Funding (deposits and milestone releases) is a
 * separate ledger and lives in its own section, clearly labelled.
 *
 * Cost blocks — phase cost versus budget — are the contractor's internal
 * position and need `finances:viewCosts`, so a client-side role never sees
 * them (and never fires a request the API would refuse).
 */
export default function ProjectFinances() {
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "finances", "manage");
  const canViewCosts = access?.capabilities?.canViewCosts ?? false;
  const { data: summary, isPending } = useFinancePosition(project.id);

  if (isPending) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="w-full px-4 pb-8 pt-4 sm:px-10 lg:px-6">
        <PageHeader title="Finance" />
        <EmptyState
          icon={<FinancesIcon />}
          title="No finance data yet"
          description="The contract position appears here once the project's contract sum and terms are set up."
        />
      </div>
    );
  }

  const contractsHref = `/project/${project.id}/${CONTRACTS_PHASES_PATH}`;

  return (
    <div className="w-full px-4 pb-8 pt-4 sm:px-10 lg:px-6">
      <PageHeader title="Finance" />

      <Card padding="lg" className="mt-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-xl">
            <h3 className="text-sm font-semibold text-ink-muted">Contract</h3>
            <p className="mt-1 text-xs text-ink-muted">
              Contract sum through variations to what has been certified, what has been received
              against those certificates and what is still to certify. Every figure is read from
              the certificates and their recorded receipts.
            </p>
          </div>
          {isSettled(summary) ? (
            <Badge tone="success" size="md" className="gap-1.5">
              <span aria-hidden="true">✓</span>
              Settled
            </Badge>
          ) : null}
        </div>
        <SettlementStatement summary={summary} />
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line-hair pt-4 text-xs text-ink-muted">
          <span>Recorded figures — the contract sum and terms live on the main contract.</span>
          <Link to={contractsHref} className="font-semibold text-primary-500 hover:underline">
            Open Contracts &amp; phases ›
          </Link>
        </div>
      </Card>

      <MoneyStrip projectId={project.id} summary={summary} />

      <div className="mt-6 flex flex-col gap-6">
        <LdExposureCard summary={summary} />
        {canViewCosts ? (
          <PhaseVarianceCard
            projectId={project.id}
            currency={summary.currency}
            phases={summary.phases}
          />
        ) : null}
        <ChangeOrdersCard projectId={project.id} />
        <RecentInvoicesCard projectId={project.id} currency={summary.currency} />
        <FundingSection
          projectId={project.id}
          currency={summary.currency}
          funding={summary.funding}
          canManage={canManage}
        />
      </div>
    </div>
  );
}
