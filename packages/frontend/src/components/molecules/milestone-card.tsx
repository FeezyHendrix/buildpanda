import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ExternalLinkIcon } from "@/components/atoms/project-nav-icons";
import { formatCurrency } from "@/lib/formatters";
import { MILESTONE_CLAIM_STATE_META } from "@/lib/project-meta";
import { cn } from "@/lib/utils";
import type {
  MilestonePayment,
  ProjectFinances,
} from "@/lib/project-types";
import { ReactSVG } from "react-svg";
import { icons } from "@/assets/icons/icons";

type MilestoneVariant = "compact" | "detailed";

interface MilestoneCardProps {
  milestone: MilestonePayment;
  currency: ProjectFinances["currency"];
  variant?: MilestoneVariant;
  onViewDocs?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
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
  const releaseEnabled =
    milestone.status !== "Completed" && milestone.proof?.verified === true;
  const amountLabel = milestone.amount
    ? formatCurrency(milestone.amount, currency)
    : "-";

  const body = (
    <>
      <header className="flex items-center justify-between gap-2 border-b border-line-hair pb-4">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-ink">
            {milestone.name || "Untitled milestone"}
          </p>
          <p className="mt-0.5 text-xs text-black-300">
            Phase: {milestone.phase || "-"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge milestone={milestone} />
          <ClaimStateBadge milestone={milestone} />
        </div>
      </header>

      <div className='flex flex-col gap-6'>
        <div className='flex items-center justify-between'>
          <p className='text-sm text-black-300'>Amount</p>
          <p
            className={cn(
              "font-medium tabular-nums text-black-500",
              variant === "detailed" ? "text-2xl" : "text-lg",
            )}
          >
            {amountLabel}
          </p>
        </div>

        {variant === "detailed" ? (
          <div className="flex flex-col gap-6 rounded-lg text-xs">
            <MetaRow label="Verified Proof">
              <ProofValue proof={milestone.proof} />
            </MetaRow>
            <MetaRow label="Inspector Sign-off">
              <SignOffValue value={milestone.inspectorSignOff} />
            </MetaRow>
          </div>
        ) : (
          <div className='flex flex-col gap-4'>
            <div className='flex items-center justify-between'>
              <p className='text-sm text-black-300'>Verified Proof</p>
              <div className="flex items-center gap-2">
                <ReactSVG src={icons.paperclip} />
                <p className="text-sm text-primary">
                  {milestone.proof?.fileName ?? "Pending upload"}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className='text-sm text-black-300'>Inspector Sign-off</p>
              <p className="text-sm">
                <SignOffValue value={milestone.inspectorSignOff} />
              </p>
            </div>
          </div>
        )}

        <footer
          className={cn(
            "flex items-center justify-between gap-2 border-t pt-4",
            variant === "detailed"
              ? "border-line-hair"
              : "mt-1 border-line-hair",
          )}
        >
          <div className="flex items-center gap-1">
            <Button type="button" size="sm" variant="ghost" onClick={onViewDocs}>
              View docs
            </Button>
            {onRaiseDispute ? (
              <Button type="button" size="sm" variant="ghost" className="text-error-500" onClick={onRaiseDispute}>
                Raise dispute
              </Button>
            ) : null}
          </div>
          <Button type="button" size="sm" variant="primary" disabled={!releaseEnabled} onClick={onReleaseFunds}>
            Release funds
          </Button>
        </footer>
      </div>
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
        "flex flex-col w-[420px] gap-6 rounded-[12px] border border-line-hair bg-white p-4",
        className,
      )}
    >
      {body}
    </div>
  );
}

function ClaimStateBadge({ milestone }: { milestone: MilestonePayment }) {
  const meta = MILESTONE_CLAIM_STATE_META[milestone.claimState ?? "pending"];
  return (
    <Badge tone={meta.tone} size="sm" className="gap-1 text-xs">
      <span aria-hidden="true">{meta.glyph}</span>
      {meta.label}
    </Badge>
  );
}

function StatusBadge({ milestone }: { milestone: MilestonePayment }) {
  if (milestone.status === "Completed") {
    return (
      <Badge tone="success" size="md" className='text-xs'>
        {milestone.percentComplete}% Completed
      </Badge>
    );
  }
  if (milestone.status === "InProgress") {
    return (
      <Badge tone="warning" size="md" className='text-xs'>
        {milestone.percentComplete}% Progress
      </Badge>
    );
  }
  return (
    <Badge tone="neutral" size="md" className='text-xs'>
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
      className="inline-flex items-center gap-1 font-medium text-primary-500 hover:underline"
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
      <span className="inline-flex items-center gap-1 font-medium text-success-500">
        <ReactSVG src={icons.verified} />
        Verified
      </span>
    );
  }
  if (value === "Scheduled") {
    return <span className="inline-flex items-center gap-1 font-medium text-warning-500">
      <ReactSVG
        src={icons.hourglassLine}
        beforeInjection={(svg) => {
          svg.setAttribute("stroke", "#C26A00");
        }}
      />
      Scheduled
    </span>;
  }
  return <span className="text-gray-500">Pending</span>;
}

MilestoneCard.displayName = "MilestoneCard";

export { MilestoneCard, type MilestoneCardProps, type MilestoneVariant };
