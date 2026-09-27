import { useQueries } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Badge } from "@/components/atoms/badge";
import { preconApi, type PreconRowStatus } from "@/api/precon";
import { takeoffLinkKeys } from "@/hooks/query-keys";

export type TakeoffLineStatus = { sessionId: string; status: PreconRowStatus | null };

/**
 * Resolves each linked take-off line's review status. One snapshot fetch per
 * distinct session (an estimate rarely links more than a couple), mapped down
 * to row id → status so rows render a chip without their own request.
 */
export function useTakeoffLineStatuses(sessionIds: string[]): Map<string, TakeoffLineStatus> {
  const unique = [...new Set(sessionIds)];
  const results = useQueries({
    queries: unique.map((sessionId) => ({
      queryKey: takeoffLinkKeys.lineStatuses(sessionId),
      queryFn: () => preconApi.snapshot(sessionId),
      staleTime: 30_000,
    })),
  });
  const map = new Map<string, TakeoffLineStatus>();
  results.forEach((result, index) => {
    const sessionId = unique[index]!;
    for (const row of result.data?.rows ?? []) map.set(row.id, { sessionId, status: row.status });
  });
  return map;
}

const STATUS_META: Record<PreconRowStatus, { label: string; tone: "neutral" | "warning" | "success" | "danger" }> = {
  ai_generated: { label: "draft", tone: "neutral" },
  needs_review: { label: "needs review", tone: "warning" },
  verified: { label: "verified", tone: "success" },
  rejected: { label: "rejected", tone: "danger" },
};

interface ChipProps {
  boqItemId: string | null;
  takeoffSessionId: string | null;
  statuses: Map<string, TakeoffLineStatus>;
}

/** "from take-off · verified" with a link to the line, or "hand-entered". */
export function TakeoffLinkChip({ boqItemId, takeoffSessionId, statuses }: ChipProps) {
  if (!boqItemId) return <Badge tone="neutral">hand-entered</Badge>;
  const resolved = statuses.get(boqItemId);
  const sessionId = resolved?.sessionId ?? takeoffSessionId;
  const meta = resolved?.status ? STATUS_META[resolved.status] : null;
  const chip = (
    <Badge tone={meta?.tone ?? "info"} dot={Boolean(meta)}>
      from take-off{meta ? ` · ${meta.label}` : ""}
    </Badge>
  );
  if (!sessionId) return chip;
  return (
    <Link to={`/sales/takeoff/${sessionId}?row=${boqItemId}`} className="inline-flex" title="Open this line in the take-off">
      {chip}
    </Link>
  );
}
TakeoffLinkChip.displayName = "TakeoffLinkChip";
