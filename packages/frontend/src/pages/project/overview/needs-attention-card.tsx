import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import api from "@/api/client";
import { Spinner } from "@/components/atoms/spinner";
import { ChevronRightIcon } from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { QueryError } from "@/components/molecules/query-error";
import { cn } from "@/lib/utils";
import { CardHeaderButton, OverviewCard } from "./overview-card";

/** Rows shown before "View All"; the design shows four. */
const COLLAPSED_LIMIT = 4;
const FETCH_LIMIT = 50;

type AttentionTag = "blocking" | "due_soon" | "review";

interface AttentionItem {
  id: string;
  kind: string;
  tag: AttentionTag;
  title: string;
  assignee: { id: string | null; name: string; profession: string | null } | null;
  dueDate: string | null;
  href: string;
}

const TAG_META: Record<AttentionTag, { label: string; className: string }> = {
  blocking: { label: "Blocking", className: "border-[#FFD9D9] bg-[#FFF1F1] text-[#E7000B]" },
  due_soon: { label: "Due Soon", className: "border-[#FFE7A8] bg-[#FFF8E6] text-[#E17100]" },
  review: { label: "Review", className: "border-[#D6E3FF] bg-[#EDF3FF] text-[#004DE7]" },
};

const KIND_LABEL: Record<string, string> = {
  rfi: "RFIs",
  approval: "Approvals",
  change_request: "Change requests",
  task: "Tasks",
  inspection: "Inspections",
  permit: "Permits",
  key_date: "Key dates",
};

/** The server decides what is blocking, due soon or waiting on someone (docs/overview-page-backend.md). */
function useAttentionAreas(projectId: string) {
  return useQuery({
    queryKey: ["projects", projectId, "attention-areas", FETCH_LIMIT],
    queryFn: () =>
      api
        .get<{ items: AttentionItem[]; total: number }>(`/projects/${projectId}/attention-areas`, { params: { limit: FETCH_LIMIT } })
        .then((r) => r.data),
  });
}

function AttentionRow({ item }: { item: AttentionItem }) {
  const tag = TAG_META[item.tag];
  const who = item.assignee ? `${item.assignee.name}${item.assignee.profession ? ` | ${item.assignee.profession}` : ""}` : null;
  return (
    <li className="last:[&>*]:border-b-0">
      <Link
        to={item.href}
        className="flex items-center justify-between gap-3 border-b border-[#EEEEEE] px-[14px] pb-[10px] pt-[11px] hover:bg-[#FAFAFA]"
      >
        <div className="min-w-0">
          <span className={cn("inline-flex h-[20px] items-center rounded-full border px-[8px] text-[12px] font-medium leading-[16px]", tag.className)}>
            {tag.label}
          </span>
          <p className="mt-[8px] truncate text-[14px] leading-[20px] text-[#1E1E1E]">{item.title}</p>
          <p className="truncate text-[12px] leading-[16px] text-[#737373]">
            {who ?? KIND_LABEL[item.kind] ?? item.kind}
            {item.dueDate ? ` · due ${item.dueDate}` : ""}
          </p>
        </div>
        <ChevronRightIcon className="size-[16px] shrink-0 text-[#1E1E1E]" />
      </Link>
    </li>
  );
}

export function NeedsAttentionCard({ projectId, className }: { projectId: string; className?: string }) {
  const feed = useAttentionAreas(projectId);
  const [expanded, setExpanded] = useState(false);
  const items = feed.data?.items ?? [];
  const hasMore = items.length > COLLAPSED_LIMIT;
  const visible = expanded ? items : items.slice(0, COLLAPSED_LIMIT);

  return (
    <OverviewCard
      title="Attention Areas"
      className={className}
      action={
        hasMore ? (
          <CardHeaderButton onClick={() => setExpanded((open) => !open)}>
            {expanded ? "Show Less" : `View All (${feed.data?.total ?? items.length})`}
          </CardHeaderButton>
        ) : null
      }
    >
      <div className="flex flex-1 flex-col">
        {feed.error ? (
          <QueryError error={feed.error} retry={feed.refetch} noun="attention items" />
        ) : feed.isPending ? (
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
              <AttentionRow key={`${item.kind}:${item.id}`} item={item} />
            ))}
          </ul>
        )}
      </div>
    </OverviewCard>
  );
}

NeedsAttentionCard.displayName = "NeedsAttentionCard";
