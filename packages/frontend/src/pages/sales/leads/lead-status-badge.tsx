import { Badge } from "@/components/atoms/badge";
import { type LeadStatus } from "@/api/leads";

export const STATUS_TONE: Record<LeadStatus, "neutral" | "info" | "warning" | "success" | "danger" | "accent"> = {
  New: "info",
  Contacted: "accent",
  Qualified: "warning",
  ProposalOpened: "neutral",
  Won: "success",
  Lost: "danger",
};

export function statusLabel(s: LeadStatus): string {
  return s === "ProposalOpened" ? "Proposal Opened" : s;
}

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{statusLabel(status)}</Badge>;
}
