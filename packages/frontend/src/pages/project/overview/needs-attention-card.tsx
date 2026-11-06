import { QueryError } from "@/components/molecules/query-error";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Spinner } from "@/components/atoms/spinner";
import { ChevronRightIcon } from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { useChangeRequestSummary } from "@/hooks/use-change-requests";
import { useKeyDates } from "@/hooks/use-key-dates";
import { useProjectRfis } from "@/hooks/use-rfis";
import { useReportingSnapshot } from "@/hooks/use-reporting-snapshot";
import { BUDGET_INVOICES_PATH } from "@/lib/finance-routes";
import type { ProjectReportingSnapshot } from "@/hooks/use-reporting-snapshot";
import type { KeyDate, Rfi } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import { CardHeaderButton, OverviewCard } from "./overview-card";

const OPEN_RFI_STATUSES = new Set<Rfi["status"]>(["Open", "InReview"]);
/** Days without a site update before the dashboard nags. */
const STALE_UPDATE_DAYS = 3;
/** Rows shown before "View All". */
const COLLAPSED_LIMIT = 5;

type AttentionTag = "Blocking" | "Due soon" | "Review";

const TAG_STYLE: Record<AttentionTag, string> = {
  Blocking: "border-[#FFD9D9] bg-[#FFF1F1] text-[#E7000B]",
  "Due soon": "border-[#FFE7A8] bg-[#FFF8E6] text-[#E17100]",
  Review: "border-[#D6E3FF] bg-[#EDF3FF] text-[#004DE7]",
};

interface AttentionItem {
  key: string;
  count: number;
  label: string;
  /** Route tail under `/project/:id/`, or a hash on this page. */
  to: string;
  tag: AttentionTag;
  /** The part of the project the item lives in. */
  area: string;
}

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function countOverdueRfis(rfis: Rfi[], today: number): number {
  return rfis.filter((r) => {
    if (!OPEN_RFI_STATUSES.has(r.status) || !r.dueDate) return false;
    const due = new Date(r.dueDate).getTime();
    return !Number.isNaN(due) && due < today;
  }).length;
}

function countMissedKeyDates(keyDates: KeyDate[], today: number): number {
  return keyDates.filter((k) => {
    if (k.actualDate || !k.targetDate) return false;
    const target = new Date(k.targetDate).getTime();
    return !Number.isNaN(target) && target < today;
  }).length;
}

/** "3 delayed activities (11 days lost)" — the days are the part that matters. */
function delayedLabel(delayed: { count: number; daysLost: number } | null): string {
  if (!delayed || delayed.daysLost <= 0) return "delayed activities";
  return `delayed activities · ${delayed.daysLost} ${delayed.daysLost === 1 ? "day" : "days"} lost`;
}

/** Ordered by urgency; rows with a zero count are dropped before render. */
function buildItems(args: {
  snapshot: ProjectReportingSnapshot | undefined;
  rfis: Rfi[];
  keyDates: KeyDate[];
  submittedChanges: number;
}): AttentionItem[] {
  const { snapshot, rfis, keyDates, submittedChanges } = args;
  const today = startOfToday();
  const ops = snapshot?.operations;
  const staleDays = snapshot?.activity.daysSinceLastUpdate ?? null;
  const items: AttentionItem[] = [
    {
      key: "overdue-rfis",
      count: ops?.overdueRfis ?? countOverdueRfis(rfis, today),
      label: "overdue RFIs",
      to: "rfis?status=overdue",
      tag: "Blocking", area: "RFIs",
    },
    { key: "approvals", count: ops?.pendingApprovals ?? 0, label: "pending approvals", to: "approvals?status=Pending", tag: "Review", area: "Approvals", },
    { key: "changes", count: submittedChanges, label: "change orders awaiting decision", to: "change-requests", tag: "Review", area: "Change requests", },
    { key: "inspections", count: snapshot?.inspections.failed ?? 0, label: "failed inspections", to: "inspections", tag: "Blocking", area: "Inspections", },
    // An expired permit and one expiring in a month are different problems; the
    // tile used to call both "permits expiring" (finding #10).
    { key: "permits-expired", count: ops?.expiredPermits ?? 0, label: "permits expired", to: "permits", tag: "Blocking", area: "Permits", },
    { key: "permits", count: ops?.expiringPermits ?? 0, label: "permits expiring within 30 days", to: "permits", tag: "Due soon", area: "Permits", },
    { key: "overdue-tasks", count: ops?.overdueTasks ?? 0, label: "overdue tasks", to: "tasks", tag: "Blocking", area: "Tasks", },
    {
      key: "delayed",
      count: snapshot?.schedule.delayedActivities?.count ?? 0,
      label: delayedLabel(snapshot?.schedule.delayedActivities ?? null),
      to: "schedules/activities?delayed=1",
      tag: "Blocking", area: "Programme",
    },
    { key: "late-orders", count: ops?.lateMaterialOrders ?? 0, label: "material orders late", to: "materials?late=late", tag: "Blocking", area: "Materials", },
    { key: "material-approvals", count: ops?.pendingMaterialApprovals ?? 0, label: "material approvals pending", to: "material-approvals", tag: "Review", area: "Materials", },
    { key: "invoices", count: snapshot?.finance.invoices.overdueCount ?? 0, label: "overdue invoices", to: `${BUDGET_INVOICES_PATH}?tab=invoices&status=Overdue`, tag: "Blocking", area: "Finance", },
    { key: "key-dates", count: countMissedKeyDates(keyDates, today), label: "missed key dates", to: "schedules/key-dates", tag: "Blocking", area: "Key dates", },
    { key: "risks", count: snapshot?.risks.high ?? 0, label: "high risks", to: "#risk-factors", tag: "Review", area: "Risks", },
    {
      key: "stale",
      count: staleDays !== null && staleDays >= STALE_UPDATE_DAYS ? staleDays : 0,
      label: "days without a site update",
      to: "updates",
      tag: "Due soon", area: "Site updates",
    },
  ];
  return items.filter((i) => i.count > 0);
}

function AttentionRow({ item, projectId }: { item: AttentionItem; projectId: string }) {
  const body = (
    <>
      <div className="min-w-0">
        <span
          className={cn(
            "inline-flex h-[20px] items-center rounded-full border px-[8px] text-[12px] font-medium leading-[16px]",
            TAG_STYLE[item.tag],
          )}
        >
          {item.tag}
        </span>
        <p className="mt-[8px] truncate text-[14px] leading-[20px] text-[#1E1E1E]">
          <span className="tabular-nums">{item.count}</span> {item.label}
        </p>
        <p className="text-[12px] leading-[16px] text-[#737373]">{item.area}</p>
      </div>
      <ChevronRightIcon className="size-[16px] shrink-0 text-[#1E1E1E]" />
    </>
  );
  const rowClass =
    "flex items-center justify-between gap-3 border-b border-[#EEEEEE] px-[14px] pb-[10px] pt-[11px] hover:bg-[#FAFAFA]";
  // A hash target is a panel on this page; a plain anchor scrolls to it, a router Link does not.
  return (
    <li className="last:[&>*]:border-b-0">
      {item.to.startsWith("#") ? (
        <a href={item.to} className={rowClass}>{body}</a>
      ) : (
        <Link to={`/project/${projectId}/${item.to}`} className={rowClass}>{body}</Link>
      )}
    </li>
  );
}

export function NeedsAttentionCard({ projectId, className }: { projectId: string; className?: string }) {
  const snapshot = useReportingSnapshot(projectId);
  const rfis = useProjectRfis(projectId);
  const keyDates = useKeyDates(projectId);
  const changes = useChangeRequestSummary(projectId);
  const [expanded, setExpanded] = useState(false);
  const isPending = snapshot.isPending || rfis.isPending || keyDates.isPending || changes.isPending;

  const items = isPending
    ? []
    : buildItems({
        snapshot: snapshot.data,
        rfis: rfis.data ?? [],
        keyDates: keyDates.data ?? [],
        submittedChanges: changes.data?.submitted ?? 0,
      });
  const hasMore = items.length > COLLAPSED_LIMIT;
  const visible = expanded ? items : items.slice(0, COLLAPSED_LIMIT);

  return (
    <OverviewCard
      title="Attention Areas"
      className={className}
      action={
        hasMore ? (
          <CardHeaderButton onClick={() => setExpanded((open) => !open)}>
            {expanded ? "Show Less" : "View All"}
          </CardHeaderButton>
        ) : null
      }
    >
      <div className="flex flex-1 flex-col">
        {snapshot.error || rfis.error || keyDates.error || changes.error ? (
          <QueryError
            error={snapshot.error || rfis.error || keyDates.error || changes.error}
            retry={() => Promise.all([snapshot.refetch(), rfis.refetch(), keyDates.refetch(), changes.refetch()])}
            noun="attention items"
          />
        ) : isPending ? (
          <div className="flex min-h-[160px] flex-1 items-center justify-center">
            <Spinner size="md" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            variant="inline"
            title="Nothing needs your attention"
            description="Blocked work, overdue RFIs, pending approvals and missed dates show up here."
          />
        ) : (
          <ul className="flex flex-col">
            {visible.map((item) => (
              <AttentionRow key={item.key} item={item} projectId={projectId} />
            ))}
          </ul>
        )}
      </div>
    </OverviewCard>
  );
}

NeedsAttentionCard.displayName = "NeedsAttentionCard";
