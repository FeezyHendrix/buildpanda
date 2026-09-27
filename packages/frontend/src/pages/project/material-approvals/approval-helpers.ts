import { MATERIAL_APPROVAL_STATUS_META } from "@/components/molecules/material-approval-card";
import type { MaterialApproval } from "@/api/material-approvals";
import type { ApprovalStatus } from "@/lib/project-types";

export { MATERIAL_APPROVAL_STATUS_META };

export type ApprovalStatusFilter = ApprovalStatus | "all";

/**
 * The old page stacked awaiting / resubmit / decided as three card groups.
 * They are the one status ladder, so they are tabs over a single table now.
 */
export const APPROVAL_STATUS_FILTERS: readonly { value: ApprovalStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "Pending", label: "Awaiting decision" },
  { value: "Resubmit", label: "Resubmit" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
] as const;

export function isAwaitingDecision(approval: MaterialApproval): boolean {
  return approval.status === "Pending" || approval.status === "Resubmit";
}

/**
 * A decided record is read-only: editing the specification under a standing
 * rejection would leave the decision referring to a sample that no longer
 * exists. The way forward is a resubmission, not an edit.
 */
export function isDecided(approval: MaterialApproval): boolean {
  return approval.status === "Approved" || approval.status === "Rejected";
}

export function matchesApprovalSearch(approval: MaterialApproval, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [approval.materialName, approval.title, approval.supplier, approval.specification].some(
    (field) => field?.toLowerCase().includes(q),
  );
}

export function formatQuantity(quantity: number, unit: string): string {
  const value = Number.isInteger(quantity)
    ? quantity.toLocaleString()
    : quantity.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return `${value} ${unit}`;
}
