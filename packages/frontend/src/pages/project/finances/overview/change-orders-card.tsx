import { useChangeRequestSummary, useChangeRequests } from "@/hooks/use-change-requests";
import { CHANGE_ORDERS_PATH } from "@/lib/finance-routes";
import type { ChangeRequest, ChangeStatus } from "@/lib/project-types";
import { OverviewCard, OverviewList, OverviewRow } from "./overview-cards";

/**
 * Change orders by status. Counts come from the summary endpoint; until it
 * answers they are read off the list so the card never shows nothing.
 */

export const CHANGE_ORDER_COUNT_CARDS = [
  { status: "Draft", key: "draft", label: "Draft", marker: "○", dot: "bg-[#737373]" },
  { status: "Submitted", key: "submitted", label: "Submitted", marker: "◔", dot: "bg-[#FF9F0A]" },
  { status: "Approved", key: "approved", label: "Approved", marker: "◕", dot: "bg-[#00C950]" },
  { status: "Executed", key: "executed", label: "Executed", marker: "●", dot: "bg-[#004DE7]" },
] as const satisfies readonly { status: ChangeStatus; key: string; label: string; marker: string; dot: string }[];

type CountKey = (typeof CHANGE_ORDER_COUNT_CARDS)[number]["key"];

export function countsFromList(items: ChangeRequest[]): Record<CountKey, number> {
  const counts: Record<CountKey, number> = { draft: 0, submitted: 0, approved: 0, executed: 0 };
  for (const item of items) {
    const card = CHANGE_ORDER_COUNT_CARDS.find((candidate) => candidate.status === item.status);
    if (card) counts[card.key] += 1;
  }
  return counts;
}

export function ChangeOrdersCard({ projectId }: { projectId: string }) {
  const { data: summary } = useChangeRequestSummary(projectId);
  const { data: items = [] } = useChangeRequests(projectId);
  const counts = summary ?? countsFromList(items);
  const to = `/project/${projectId}/${CHANGE_ORDERS_PATH}`;

  return (
    <OverviewCard title="Change orders" to={to}>
      <OverviewList>
        {CHANGE_ORDER_COUNT_CARDS.map((card) => (
          <OverviewRow key={card.key} marker={<span className={`block size-[12px] rounded-full ${card.dot}`} />} label={card.label} value={counts[card.key]} to={to} />
        ))}
      </OverviewList>
    </OverviewCard>
  );
}

ChangeOrdersCard.displayName = "ChangeOrdersCard";
