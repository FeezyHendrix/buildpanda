import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import {
  CheckIcon,
  ExternalLinkIcon,
} from "@/components/atoms/project-nav-icons";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type {
  MilestonePayment,
  ProjectFinances,
} from "@/lib/project-mock-data";

type MilestoneVariant = "compact" | "detailed";

interface MilestoneCardProps {
  milestone: MilestonePayment;
  currency: ProjectFinances["currency"];
  variant?: MilestoneVariant;
  onViewDocs?: () => void;
  onRaiseDispute?: () => void;
  onReleaseFunds?: () => void;
  className?: string;
}

function MilestoneCard({
  milestone,
  currency,
  variant = "compact",
  onViewDocs,
  onRaiseDispute,
  onReleaseFunds,
  className,
}: MilestoneCardProps) {
  const releaseEnabled = milestone.status === "Completed";
  const amountLabel = milestone.amount
    ? formatCurrency(milestone.amount, currency)
    : "—";

  const body = (
    <>
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">
            {milestone.name || "Untitled milestone"}
          </p>
          <p className="mt-0.5 text-[11px] text-gray-500">
            Phase · {milestone.phase || "—"}
          </p>
        </div>
        <StatusBadge milestone={milestone} />
      </header>

      <p
        className={cn(
          "font-bold tabular-nums text-gray-900",
          variant === "detailed" ? "text-2xl" : "text-lg",
        )}
      >
        {amountLabel}
      </p>

      {variant === "detailed" ? (
        <div className="flex flex-col gap-2 rounded-xl bg-[#FAFAFA] p-3 text-xs">
          <MetaRow label="Verified Proof">
            <ProofValue proof={milestone.proof} />
          </MetaRow>
          <MetaRow label="Inspector Sign-off">
            <SignOffValue value={milestone.inspectorSignOff} />
          </MetaRow>
        </div>
      ) : (
        <dl className="grid grid-cols-2 gap-y-1 text-[11px] text-gray-500">
          <dt>Verified Proof</dt>
          <dd className="text-right text-gray-700">
            {milestone.proof?.fileName ?? "Pending upload"}
          </dd>
          <dt>Inspector Sign-off</dt>
          <dd className="text-right">
            <SignOffValue value={milestone.inspectorSignOff} />
          </dd>
        </dl>
      )}

      <footer
        className={cn(
          "flex items-center justify-between gap-2 border-t pt-3",
          variant === "detailed"
            ? "border-[#F0F0F0]"
            : "mt-1 border-[#EDEDED]",
        )}
      >
        <div className="flex gap-3 text-[11px]">
          <button
            type="button"
            onClick={onViewDocs}
            className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-900"
          >
            View Docs
            <ExternalLinkIcon className="size-3" />
          </button>
          <button
            type="button"
            onClick={onRaiseDispute}
            className="text-[#C72525] hover:underline"
          >
            Raise Dispute
          </button>
        </div>
        <Button
          type="button"
          size="sm"
          variant="primary"
          disabled={!releaseEnabled}
          onClick={onReleaseFunds}
          className="h-8 px-3 text-xs"
        >
          Release funds
        </Button>
      </footer>
    </>
  );

  if (variant === "detailed") {
    return (
      <Card padding="lg" className={cn("flex flex-col gap-4", className)}>
        {body}
      </Card>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-[#EDEDED] bg-[#FAFAFA] p-4",
        className,
      )}
    >
      {body}
    </div>
  );
}

function StatusBadge({ milestone }: { milestone: MilestonePayment }) {
  if (milestone.status === "Completed") {
    return (
      <Badge tone="success" size="md">
        {milestone.percentComplete}% Completed
      </Badge>
    );
  }
  if (milestone.status === "InProgress") {
    return (
      <Badge tone="warning" size="md">
        {milestone.percentComplete}% Progress
      </Badge>
    );
  }
  return (
    <Badge tone="neutral" size="md">
      Pending
    </Badge>
  );
}

function MetaRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function ProofValue({ proof }: { proof: MilestonePayment["proof"] }) {
  if (!proof?.fileName) {
    return <span className="text-gray-500">Pending upload</span>;
  }
  return (
    <a
      href="#"
      className="inline-flex items-center gap-1 font-medium text-[#004DE7] hover:underline"
    >
      {proof.fileName}
      <ExternalLinkIcon className="size-3" />
    </a>
  );
}

function SignOffValue({
  value,
}: {
  value: MilestonePayment["inspectorSignOff"];
}) {
  if (value === "Verified") {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-[#1B8E45]">
        <CheckIcon className="size-3.5" />
        Verified
      </span>
    );
  }
  if (value === "Scheduled") {
    return <span className="font-medium text-[#C26A00]">Scheduled</span>;
  }
  return <span className="text-gray-500">Pending</span>;
}

MilestoneCard.displayName = "MilestoneCard";

export { MilestoneCard, type MilestoneCardProps, type MilestoneVariant };
