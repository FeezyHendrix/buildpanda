import { Link } from "react-router-dom";
import { Badge, type BadgeTone } from "@/components/atoms/badge";
import { Card } from "@/components/atoms/card";
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

const OPEN_RFI_STATUSES = new Set<Rfi["status"]>(["Open", "InReview"]);
/** Days without a site update before the dashboard nags. */
const STALE_UPDATE_DAYS = 3;

interface AttentionItem {
  key: string;
  count: number;
  label: string;
  /** Route tail under `/project/:id/`, or a hash on this page. */
  to: string;
  tone: BadgeTone;
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
    { key: "blocked", count: ops?.blockedActionItems ?? 0, label: "blocked action items", to: "action-items", tone: "danger" },
    { key: "overdue-rfis", count: countOverdueRfis(rfis, today), label: "overdue RFIs", to: "rfis", tone: "danger" },
    { key: "due-actions", count: ops?.dueActionItems ?? 0, label: "action items due", to: "action-items", tone: "warning" },
    { key: "approvals", count: ops?.pendingApprovals ?? 0, label: "pending approvals", to: "approvals", tone: "warning" },
    { key: "changes", count: submittedChanges, label: "change orders awaiting decision", to: "change-requests", tone: "warning" },
    { key: "inspections", count: snapshot?.inspections.failed ?? 0, label: "failed inspections", to: "inspections", tone: "danger" },
    { key: "permits", count: ops?.expiringPermits ?? 0, label: "permits expiring", to: "permits", tone: "warning" },
    { key: "invoices", count: snapshot?.finance.invoices.overdueCount ?? 0, label: "overdue invoices", to: `${BUDGET_INVOICES_PATH}?tab=invoices`, tone: "danger" },
    { key: "key-dates", count: countMissedKeyDates(keyDates, today), label: "missed key dates", to: "key-dates", tone: "danger" },
    { key: "risks", count: snapshot?.risks.high ?? 0, label: "high risks", to: "#risk-factors", tone: "warning" },
    { key: "queries", count: ops?.openQueries ?? 0, label: "open queries", to: "queries", tone: "neutral" },
    {
      key: "stale",
      count: staleDays !== null && staleDays >= STALE_UPDATE_DAYS ? staleDays : 0,
      label: "days without a site update",
      to: "updates",
      tone: "warning",
    },
  ];
  return items.filter((i) => i.count > 0);
}

const ROW_CLASS = "flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13px] text-black-500 hover:bg-gray-50";

function AttentionRow({ item, projectId }: { item: AttentionItem; projectId: string }) {
  const body = (
    <>
      <Badge tone={item.tone} size="sm" className="min-w-[28px] justify-center tabular-nums">
        {item.count}
      </Badge>
      <span className="flex-1 truncate">{item.label}</span>
      <ChevronRightIcon className="size-4 shrink-0 text-black-300" />
    </>
  );
  // A hash target is a panel on this page; a plain anchor scrolls to it, a router Link does not.
  return (
    <li>
      {item.to.startsWith("#") ? (
        <a href={item.to} className={ROW_CLASS}>{body}</a>
      ) : (
        <Link to={`/project/${projectId}/${item.to}`} className={ROW_CLASS}>{body}</Link>
      )}
    </li>
  );
}

export function NeedsAttentionCard({ projectId, className }: { projectId: string; className?: string }) {
  const snapshot = useReportingSnapshot(projectId);
  const rfis = useProjectRfis(projectId);
  const keyDates = useKeyDates(projectId);
  const changes = useChangeRequestSummary(projectId);
  const isPending = snapshot.isPending || rfis.isPending || keyDates.isPending;

  const items = isPending
    ? []
    : buildItems({
        snapshot: snapshot.data,
        rfis: rfis.data ?? [],
        keyDates: keyDates.data ?? [],
        submittedChanges: changes.data?.submitted ?? 0,
      });

  return (
    <Card className={className}>
      <div className="flex items-center justify-between py-3 px-5">
        <h3 className="text-[13px] font-semibold text-black-300">Needs attention</h3>
        {items.length > 0 ? (
          <span className="text-[12px] text-black-300">{items.length} {items.length === 1 ? "item" : "items"}</span>
        ) : null}
      </div>
      <div className="h-full px-2 pb-2">
        {isPending ? (
          <div className="flex h-full min-h-[160px] items-center justify-center">
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
            {items.map((item) => (
              <AttentionRow key={item.key} item={item} projectId={projectId} />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

NeedsAttentionCard.displayName = "NeedsAttentionCard";
