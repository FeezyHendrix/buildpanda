import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ExternalLinkIcon } from "@/components/atoms/project-nav-icons";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type {
  MilestonePayment,
  ProjectFinances,
} from "@/lib/project-mock-data";
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
    : "—";

  const body = (
    <>
      <header className="flex items-center justify-between gap-2 border-b border-[#F6F6F6] pb-4">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-[#131B2E]">
            {milestone.name || "Untitled milestone"}
          </p>
          <p className="mt-0.5 text-[11px] text-black-300">
            Phase: {milestone.phase || "—"}
          </p>
        </div>
        <StatusBadge milestone={milestone} />
      </header>

      <div className='flex flex-col gap-6'>
        <div className='flex items-center justify-between'>
          <p className='text-[13px] text-black-300'>Amount</p>
          <p
            className={cn(
              "font-bold tabular-nums text-black-500",
              variant === "detailed" ? "text-2xl" : "text-lg",
            )}
          >
            {amountLabel}
          </p>
        </div>

        {variant === "detailed" ? (
          <div className="flex flex-col gap-6 rounded-xl text-xs">
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
              <p className='text-[13px] text-black-300'>Verified Proof</p>
              <div className="flex items-center gap-2">
                <ReactSVG src={icons.paperclip} />
                <p className="text-[13px] text-primary">
                  {milestone.proof?.fileName ?? "Pending upload"}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className='text-[13px] text-black-300'>Inspector Sign-off</p>
              <p className="text-[13px]">
                <SignOffValue value={milestone.inspectorSignOff} />
              </p>
            </div>
          </div>
        )}

        <footer
          className={cn(
            "flex items-center justify-between gap-2 border-t pt-4",
            variant === "detailed"
              ? "border-[#F6F6F6]"
              : "mt-1 border-[#F6F6F6]",
          )}
        >
          <div className="flex gap-3 text-[11px]">
            {/* <button
              type="button"
              onClick={onEdit}
              className="text-gray-500 hover:text-gray-900"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="text-red-500 hover:text-red-600"
            >
              Delete
            </button> */}
            <button
              type="button"
              onClick={onViewDocs}
              className="inline-flex items-center gap-1 text-black-300 text-[13px] font-semibold cursor-pointer"
            >
              View Docs
            </button>
            <button
              type="button"
              onClick={onRaiseDispute}
              className="text-error-500 text-[13px] font-semibold cursor-pointer"
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
        "flex flex-col w-[420px] gap-6 rounded-[12px] border border-[#F6F6F6] bg-white p-4",
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
      <Badge tone="success" size="md" className='text-[11px]'>
        {milestone.percentComplete}% Completed
      </Badge>
    );
  }
  if (milestone.status === "InProgress") {
    return (
      <Badge tone="warning" size="md" className='text-[11px]'>
        {milestone.percentComplete}% Progress
      </Badge>
    );
  }
  return (
    <Badge tone="neutral" size="md" className='text-[11px]'>
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
        <ReactSVG src={icons.verified} />
        Verified
      </span>
    );
  }
  if (value === "Scheduled") {
    return <span className="inline-flex items-center gap-1 font-medium text-[#C26A00]">
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
