import { Badge } from "@/components/atoms/badge";
import { cn } from "@/lib/utils";
import { formatTimeAgo } from "@/lib/formatters";
import type { LedgerEntry } from "@/lib/project-types";

export function LedgerRow({
  entry,
  canManage,
  onVoid,
}: {
  entry: LedgerEntry;
  canManage: boolean;
  onVoid: () => void;
}) {
  const isVoided = entry.status === "Voided";
  const isIn = entry.entryType === "IN";
  const isVoid = entry.entryType === "VOID";

  return (
    <div className={cn("flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3", isVoided && "opacity-60")}>
      <span
        className={cn(
          "flex h-9 w-12 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
          isVoid ? "bg-gray-100 text-gray-500" : isIn ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700",
        )}
      >
        {isVoid ? "VOID" : isIn ? "IN" : "USED"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">
          {entry.quantity} {entry.unit} · {entry.materialName}
          {entry.negativeStock && <Badge tone="danger" size="sm" className="ml-2">Negative</Badge>}
          {entry.timestampSuspect && <Badge tone="warning" size="sm" className="ml-2">Time flagged</Badge>}
        </p>
        <p className="mt-0.5 truncate text-xs text-gray-500">
          {entry.loggedByName ?? "Someone"} · {formatTimeAgo(entry.occurredAt)}
          {entry.reason ? ` · ${entry.reason}` : ""}
        </p>
        {entry.notesHtml && entry.notesHtml.trim().length > 0 && (
          <div
            className="prose prose-sm mt-1 max-w-none text-xs text-gray-600 [&_img]:max-h-40 [&_img]:rounded-lg [&_p]:my-0.5"
            dangerouslySetInnerHTML={{ __html: entry.notesHtml }}
          />
        )}
      </div>
      {entry.files.length > 0 && (
        <a
          href={entry.files[0]!.url}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-xs font-medium text-[#004DE7] hover:underline"
        >
          Photo
        </a>
      )}
      {canManage && !isVoided && !isVoid && (
        <button
          type="button"
          onClick={onVoid}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-gray-400 hover:bg-red-50 hover:text-red-500"
        >
          Void
        </button>
      )}
    </div>
  );
}
