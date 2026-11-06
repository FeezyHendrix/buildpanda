import type { Approval, ApprovalStatus } from "@/lib/project-types";

/** The status filters on the panel. "Needs my approval" and "Awaiting approval" both come from `Pending`. */
export type ApprovalFilter = "all" | "needs-me" | "awaiting" | "Approved" | "Rejected" | "Resubmit";

export const APPROVAL_FILTERS: { value: ApprovalFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "needs-me", label: "Needs my Approval" },
  { value: "awaiting", label: "Awaiting Approval" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
  { value: "Resubmit", label: "Changes Requested" },
];

/** What the viewer sees on a card: the same stored status, read from their side of the desk. */
export type ApprovalDisplayStatus = "needs-me" | "awaiting" | "Approved" | "Rejected" | "Resubmit";

export function displayStatus(approval: Approval, mayDecide: boolean): ApprovalDisplayStatus {
  if (approval.status === "Pending") return mayDecide ? "needs-me" : "awaiting";
  return approval.status satisfies Exclude<ApprovalStatus, "Pending">;
}

export const DISPLAY_STATUS_META: Record<ApprovalDisplayStatus, { label: string; className: string }> = {
  "needs-me": { label: "Needs my Approval", className: "border-transparent bg-[#E4ECFF] text-[#004DE7]" },
  awaiting: { label: "Awaiting Approval", className: "border-[#FEE685] bg-[#FFFBEB] text-[#E17100]" },
  Approved: { label: "Approved", className: "border-[#B9F8CF] bg-[#F0FDF4] text-[#00A63E]" },
  Rejected: { label: "Rejected", className: "border-[#FFC9C9] bg-[#FEF2F2] text-[#E7000B]" },
  Resubmit: { label: "Changes Requested", className: "border-[#EBEBEB] bg-white text-[#1E1E1E]" },
};

/** Waiting items first (what needs a person), then everything settled; API order is kept within each. */
export function sortByAttention(approvals: Approval[], mayDecideOf: (a: Approval) => boolean): Approval[] {
  const rank = (a: Approval): number => {
    if (a.status === "Pending") return mayDecideOf(a) ? 0 : 1;
    if (a.status === "Resubmit") return 2;
    return 3;
  };
  return approvals
    .map((approval, index) => ({ approval, index }))
    .sort((a, b) => rank(a.approval) - rank(b.approval) || a.index - b.index)
    .map(({ approval }) => approval);
}

export function matchesApprovalSearch(approval: Approval, rawQuery: string): boolean {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;
  return [approval.title, approval.description, approval.category, approval.requestedReviewerName].some((field) =>
    field?.toLowerCase().includes(query),
  );
}

/** `from` / `to` are `yyyy-mm-dd` (inclusive, "" = open) compared with the day the request was submitted. */
export function matchesSubmittedRange(approval: Approval, from: string, to: string): boolean {
  if (!from && !to) return true;
  const day = new Date(approval.createdAt).toLocaleDateString("en-CA");
  return (!from || day >= from) && (!to || day <= to);
}
