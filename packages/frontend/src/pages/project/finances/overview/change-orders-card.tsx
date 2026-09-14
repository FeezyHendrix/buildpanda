import { Link } from "react-router-dom";
import { useChangeRequestSummary, useChangeRequests } from "@/hooks/use-change-requests";
import { CHANGE_ORDERS_PATH } from "@/lib/finance-routes";
import type { ChangeRequest, ChangeStatus } from "@/lib/project-types";
import { OverviewCard } from "./overview-cards";

/**
 * Change orders by status. Counts come from the summary endpoint; until it
 * answers they are read off the list so the card never shows nothing.
 */

export const CHANGE_ORDER_COUNT_CARDS = [
  { status: "Draft", key: "draft", label: "Draft", marker: "○" },
  { status: "Submitted", key: "submitted", label: "Submitted", marker: "◔" },
  { status: "Approved", key: "approved", label: "Approved", marker: "◕" },
  { status: "Executed", key: "executed", label: "Executed", marker: "●" },
] as const satisfies readonly { status: ChangeStatus; key: string; label: string; marker: string }[];

type CountKey = (typeof CHANGE_ORDER_COUNT_CARDS)[number]["key"];

export function countsFromList(items: ChangeRequest[]): Record<CountKey, number> {
  const counts: Record<CountKey, number> = { draft: 0, submitted: 0, approved: 0, executed: 0 };
  for (const item of items) {
    const card = CHANGE_ORDER_COUNT_CARDS.find((candidate) => candidate.status === item.status);
    if (card) counts[card.key] += 1;
  }
  return counts;
}

export function ChangeOrderCountTile({ label, marker, count, to }: { label: string; marker: string; count: number | null; to?: string }) {
  const body = (
    <div className="rounded-lg border border-line-hair bg-white p-4 transition-shadow hover:shadow-sm">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase text-ink-muted">
        <span aria-hidden="true">{marker}</span>
        {label}
      </p>
      <p className="mt-2 text-2xl font-medium leading-tight tabular-nums text-ink">{count === null ? "—" : count}</p>
    </div>
  );
  return to ? (
    <Link to={to} className="block rounded-lg focus-visible:outline-none focus-visible:shadow-focus">
      {body}
    </Link>
  ) : (
    body
  );
}

ChangeOrderCountTile.displayName = "ChangeOrderCountTile";

export function ChangeOrdersCard({ projectId }: { projectId: string }) {
  const { data: summary } = useChangeRequestSummary(projectId);
  const { data: items = [] } = useChangeRequests(projectId);
  const counts = summary ?? countsFromList(items);
  const to = `/project/${projectId}/${CHANGE_ORDERS_PATH}`;

  return (
    <OverviewCard title="Change orders" description="Where each scope change stands, from draft to executed contract." to={to}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CHANGE_ORDER_COUNT_CARDS.map((card) => (
          <ChangeOrderCountTile key={card.key} label={card.label} marker={card.marker} count={counts[card.key]} to={to} />
        ))}
      </div>
    </OverviewCard>
  );
}

ChangeOrdersCard.displayName = "ChangeOrdersCard";
