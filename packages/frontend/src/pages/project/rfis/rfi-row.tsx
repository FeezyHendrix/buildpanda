import { Badge } from "@/components/atoms/badge";
import { formatDayMonth } from "@/lib/formatters";
import { isRfiOverdue, overdueLabel, rfiOverdueDays, RFI_STATUS_META } from "@/lib/rfi-meta";
import { cn } from "@/lib/utils";
import type { Rfi } from "@/lib/project-types";

interface RfiRowProps {
  rfi: Rfi;
  onOpen: (id: string) => void;
}

function RfiRow({ rfi, onOpen }: RfiRowProps) {
  const overdue = isRfiOverdue(rfi);
  const days = rfiOverdueDays(rfi);

  return (
    // A card that opens a drawer is a button, not a div (finding F41).
    <button
      type="button"
      onClick={() => onOpen(rfi.id)}
      className={cn(
        "w-full rounded-2xl border bg-white p-4 text-left outline-none transition-shadow",
        "hover:shadow-sm focus-visible:ring-2 focus-visible:ring-gray-900/10",
        overdue ? "border-error-200" : "border-[#EDEDED]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-400">RFI-{rfi.number}</span>
            <Badge tone={RFI_STATUS_META[rfi.status].tone} size="sm">
              {RFI_STATUS_META[rfi.status].label}
            </Badge>
            {overdue ? (
              <Badge tone="danger" size="sm">
                ⚠ {overdueLabel(days)}
              </Badge>
            ) : null}
            {rfi.priority === "High" ? (
              <Badge tone="danger" size="sm">
                ▲ High
              </Badge>
            ) : null}
            {rfi.changeRequestId ? (
              <Badge tone="accent" size="sm">
                Change event
              </Badge>
            ) : null}
          </div>
          <p className="mt-1.5 truncate text-sm font-medium text-gray-900">{rfi.subject}</p>
          <p className="mt-0.5 line-clamp-1 text-sm text-gray-500">{rfi.question}</p>
        </div>
        <div className="shrink-0 text-right">
          {rfi.ballInCourtName ? <p className="text-xs text-gray-500">{rfi.ballInCourtName}</p> : null}
          {rfi.dueDate ? (
            <p className={cn("mt-0.5 text-xs", overdue ? "font-semibold text-error-600" : "text-gray-400")}>
              Due {formatDayMonth(rfi.dueDate)}
            </p>
          ) : null}
          {rfi.commentCount > 0 ? (
            <p className="mt-0.5 text-xs text-gray-400">{rfi.commentCount} response(s)</p>
          ) : null}
        </div>
      </div>
    </button>
  );
}

RfiRow.displayName = "RfiRow";

export { RfiRow, type RfiRowProps };
