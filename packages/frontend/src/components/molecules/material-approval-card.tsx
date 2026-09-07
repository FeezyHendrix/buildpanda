import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { MessagesIcon } from "@/components/atoms/project-nav-icons";
import { formatDayMonth } from "@/lib/formatters";
import type { ApprovalStatus } from "@/lib/project-types";
import type { MaterialApproval } from "@/api/material-approvals";
import type { MaterialDecision } from "./material-approval-decision-dialog";

/**
 * Status carries a glyph as well as a tone so it reads without colour
 * (WCAG 1.4.1) — tones come from the Badge atom, never re-typed hex.
 */
export const MATERIAL_APPROVAL_STATUS_META: Record<
  ApprovalStatus,
  { label: string; tone: "neutral" | "success" | "danger" | "warning"; glyph: string }
> = {
  Pending: { label: "Pending", tone: "neutral", glyph: "○" },
  Approved: { label: "Approved", tone: "success", glyph: "✓" },
  Rejected: { label: "Rejected", tone: "danger", glyph: "✕" },
  Resubmit: { label: "Resubmit", tone: "warning", glyph: "↻" },
};

const DECISION_ACTIONS: readonly { decision: MaterialDecision; label: string }[] = [
  { decision: "Approved", label: "Approve" },
  { decision: "Resubmit", label: "Request changes" },
  { decision: "Rejected", label: "Reject" },
] as const;

function formatQuantity(quantity: number, unit: string): string {
  return `${quantity} ${unit}`;
}

interface MetaFact {
  key: string;
  text: string;
}

function buildFacts(approval: MaterialApproval): MetaFact[] {
  const facts: MetaFact[] = [
    { key: "qty", text: formatQuantity(approval.quantity, approval.unit) },
  ];
  if (approval.supplier) facts.push({ key: "supplier", text: approval.supplier });
  const neededBy = formatDayMonth(approval.neededBy);
  if (neededBy) facts.push({ key: "needed", text: `needed ${neededBy}` });
  if (approval.phaseName) facts.push({ key: "phase", text: approval.phaseName });
  if (approval.activityName) facts.push({ key: "activity", text: approval.activityName });
  if (approval.requestedReviewerName) {
    facts.push({ key: "reviewer", text: `reviewer: ${approval.requestedReviewerName}` });
  }
  return facts;
}

interface Props {
  approval: MaterialApproval;
  canManage: boolean;
  canDecide: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDecide: (approval: MaterialApproval, decision: MaterialDecision) => void;
}

function MaterialApprovalCard({
  approval,
  canManage,
  canDecide,
  onOpen,
  onEdit,
  onDelete,
  onDecide,
}: Props) {
  const meta = MATERIAL_APPROVAL_STATUS_META[approval.status];
  const facts = buildFacts(approval);
  const awaitingDecision = approval.status === "Pending" || approval.status === "Resubmit";

  return (
    <Card className="group overflow-hidden transition-colors hover:border-gray-300">
      <div
        className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between"
        onClick={onOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
      >
        <div className="flex min-w-0 flex-grow flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-gray-900">{approval.title}</span>
            <Badge tone={meta.tone} size="sm">
              <span aria-hidden="true">{meta.glyph}</span>
              {meta.label}
            </Badge>
            {approval.commentCount > 0 ? (
              <span className="ml-1 flex items-center gap-1 text-xs font-medium text-gray-500">
                <MessagesIcon className="h-3.5 w-3.5" />
                {approval.commentCount}
              </span>
            ) : null}
          </div>

          <p className="truncate text-sm font-medium text-gray-700">{approval.materialName}</p>

          {approval.specification ? (
            <p className="line-clamp-2 text-sm text-gray-500">{approval.specification}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
            {facts.map((fact, index) => (
              <span key={fact.key} className="flex items-center gap-2">
                {index > 0 ? <span aria-hidden="true">·</span> : null}
                <span>{fact.text}</span>
              </span>
            ))}
          </div>

          {approval.response ? (
            <p className="rounded-lg bg-[#F6F6F6] px-3 py-2 text-sm text-gray-600">
              <span className="font-medium text-gray-900">
                {approval.reviewedByName ?? "Reviewer"}:
              </span>{" "}
              {approval.response}
            </p>
          ) : null}

          {canDecide && awaitingDecision ? (
            <div
              className="mt-2 flex flex-wrap items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              {DECISION_ACTIONS.map(({ decision, label }) => (
                <Button
                  key={decision}
                  size="sm"
                  variant={decision === "Approved" ? "primary" : "secondary"}
                  className={
                    decision === "Rejected"
                      ? "text-red-600 hover:bg-red-50 hover:text-red-700"
                      : undefined
                  }
                  onClick={() => onDecide(approval, decision)}
                >
                  {label}
                </Button>
              ))}
            </div>
          ) : null}
        </div>

        {canManage ? (
          <div
            className="flex items-center gap-2 self-start opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <Button variant="ghost" size="sm" onClick={onEdit}>
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={onDelete}
            >
              Delete
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

MaterialApprovalCard.displayName = "MaterialApprovalCard";

export { MaterialApprovalCard };
