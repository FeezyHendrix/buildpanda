import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { RecordDepositDialog } from "@/components/molecules/record-deposit-dialog";
import type { FundingPosition } from "@/hooks/use-finances";
import { formatCurrency } from "@/lib/formatters";
import { FundingTrailCard } from "../funding-trail-card";

/**
 * Funding — money the client has put into the project and what has been
 * released against stage milestones. This is NOT certification: it is a
 * separate ledger, it never feeds the contract waterfall above, and a QS
 * reading "certified" or "paid" on this page is reading the certificates, not
 * these figures. Everything here logs a movement made off-platform.
 */
interface FundingSectionProps {
  projectId: string;
  currency: string;
  funding: FundingPosition;
  canManage: boolean;
}

function FundingFigure({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-lg bg-surface-alt px-4 py-3">
      <p className="text-[13px] font-medium text-ink-muted">{label}</p>
      <p className="mt-1 text-lg font-medium tabular-nums text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-ink-muted">{helper}</p>
    </div>
  );
}

FundingFigure.displayName = "FundingFigure";

export function FundingSection({ projectId, currency, funding, canManage }: FundingSectionProps) {
  const [depositOpen, setDepositOpen] = useState(false);

  return (
    <section aria-label="Funding" className="flex flex-col gap-6">
      <Card padding="lg">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-xl">
            <h3 className="text-sm font-semibold text-ink-muted">Funding</h3>
            <p className="mt-1 text-xs text-ink-muted">
              Money the client has put into the project, and what has been released against stage
              milestones. Funding is not certification — none of it appears in the contract
              waterfall above, which is built from certificates and the receipts recorded on them.
            </p>
          </div>
          {canManage ? (
            <Button variant="secondary" size="sm" onClick={() => setDepositOpen(true)}>
              Record funding
            </Button>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FundingFigure
            label="Funds deposited"
            value={formatCurrency(funding.deposited, currency)}
            helper="Recorded deposits from the client"
          />
          <FundingFigure
            label="Milestones released"
            value={formatCurrency(funding.released, currency)}
            helper="Stage payments logged as released"
          />
        </div>
      </Card>

      <FundingTrailCard projectId={projectId} currency={currency} />

      <RecordDepositDialog
        open={depositOpen}
        onOpenChange={setDepositOpen}
        projectId={projectId}
        currency={currency}
      />
    </section>
  );
}

FundingSection.displayName = "FundingSection";
