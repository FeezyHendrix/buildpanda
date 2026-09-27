import { Link } from "react-router-dom";
import { Badge } from "@/components/atoms/badge";
import type { ChatMessage } from "@/lib/project-types";

export function ReferenceChip({ refItem }: { refItem: NonNullable<ChatMessage["resolvedReferences"]>[0] }) {
  if (refItem.restricted) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded border border-line-hair bg-surface-alt px-2 py-1 text-xs text-ink-muted">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        Restricted item
      </div>
    );
  }

  const typeLabels: Record<string, string> = {
    rfi: "RFI",
    action_item: "Action item",
    query: "Query",
    change_request: "Change request",
    activity: "Activity",
    task: "Task",
  };

  const label = typeLabels[refItem.type] || refItem.type;

  return (
    <Link to={refItem.url!} className="inline-flex items-center gap-2 rounded border border-line-hair bg-white px-2.5 py-1.5 text-xs transition-shadow hover:shadow-sm">
      <span className="font-medium text-ink-muted">{label}</span>
      <span className="font-semibold text-ink">{refItem.title}</span>
      {refItem.status && (
        <Badge variant="outline" className="text-[10px] leading-none py-0.5 px-1.5">{refItem.status}</Badge>
      )}
    </Link>
  );
}
