import { Badge } from "@/components/atoms/badge";
import { cn } from "@/lib/utils";
import { formatDateTime, formatTimeAgo } from "@/lib/formatters";
import type { LedgerEntry } from "@/lib/project-types";
import { AlertTriangleIcon, ClockAlertIcon, PaperclipIcon } from "./icons";
import { ENTRY_TYPE_META, formatMeasure } from "./shared";

function EntryFlags({ entry }: { entry: LedgerEntry }) {
  return (
    <>
      {entry.status === "Voided" ? (
        <Badge tone="neutral" size="sm" variant="outline">
          Voided
        </Badge>
      ) : null}
      {entry.negativeStock ? (
        <Badge tone="danger" size="sm">
          <AlertTriangleIcon className="size-3" />
          Negative stock
        </Badge>
      ) : null}
      {entry.timestampSuspect ? (
        <Badge tone="warning" size="sm">
          <ClockAlertIcon className="size-3" />
          Time flagged
        </Badge>
      ) : null}
    </>
  );
}

EntryFlags.displayName = "EntryFlags";

/**
 * One line of the material ledger.
 *
 * The ledger is an append-only contractual record: nothing is ever removed, so
 * a voided entry stays fully legible — struck through and tagged rather than
 * faded out — and every row keeps the actor and the time it happened on screen.
 */
export function LedgerRow({
  entry,
  canManage,
  onVoid,
  onApprove,
  approving,
}: {
  entry: LedgerEntry;
  canManage: boolean;
  onVoid: () => void;
  onApprove: () => void;
  approving?: boolean;
}) {
  const isPending = entry.approvalStatus === "Pending";
  const meta = ENTRY_TYPE_META[entry.entryType];
  const isVoided = entry.status === "Voided";
  const isReversal = entry.entryType === "VOID";
  const photo = entry.files[0];

  return (
    <div
      className={cn("flex gap-3 px-4 py-3.5 sm:px-5", isVoided && "bg-[#FAFAFA]")}
    >
      <Badge
        tone={meta.tone}
        size="md"
        className="mt-0.5 w-[74px] shrink-0 justify-center font-semibold"
      >
        <meta.Icon className="size-3.5" />
        {meta.label}
      </Badge>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <p
            className={cn(
              "text-sm font-semibold text-black-500",
              isVoided && "line-through decoration-gray-400",
            )}
          >
            {formatMeasure(entry.quantity, entry.unit)} · {entry.materialName}
          </p>
          <EntryFlags entry={entry} />
        </div>

        <p className="mt-1 text-xs text-gray-500">
          <span className="font-medium text-gray-700">
            {entry.loggedByName ?? "Unknown user"}
          </span>{" "}
          ·{" "}
          <time
            dateTime={entry.occurredAt}
            title={formatDateTime(entry.occurredAt)}
          >
            {formatTimeAgo(entry.occurredAt)}
          </time>
          {entry.stageName ? (
            <>
              {" "}
              · <span className="text-gray-700">{entry.stageName}</span>
            </>
          ) : null}
        </p>

        {isPending ? (
          <p className="mt-1.5 text-xs text-[#C26A00]">
            Awaiting approval — not counted in stock yet
          </p>
        ) : null}

        {entry.reason ? (
          <p className="mt-1 text-xs text-gray-500">
            <span className="font-medium text-gray-700">
              {isReversal ? "Reversal reason" : "Void reason"}:
            </span>{" "}
            {entry.reason}
          </p>
        ) : null}

        {entry.notesHtml && entry.notesHtml.trim().length > 0 ? (
          <div
            className="prose prose-sm mt-2 max-w-none text-xs text-gray-600 [&_img]:max-h-40 [&_img]:rounded-lg [&_p]:my-0.5"
            dangerouslySetInnerHTML={{ __html: entry.notesHtml }}
          />
        ) : null}
      </div>

      <div className="flex shrink-0 items-start gap-1">
        {photo ? (
          <a
            href={photo.url}
            target="_blank"
            rel="noreferrer"
            title={photo.name}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary-500 transition-colors hover:bg-primary-50"
          >
            <PaperclipIcon className="size-3.5" />
            <span className="hidden sm:inline">Proof</span>
          </a>
        ) : null}
          {canManage && isPending && !isVoided ? (
            <button
              type="button"
              onClick={onApprove}
              disabled={approving}
              title={`Approve this ${meta.verb.toLowerCase()} so it counts toward stock`}
              className="rounded-md bg-primary-500 px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
            >
              Approve
            </button>
          ) : null}
          {canManage && !isVoided && !isReversal ? (
            <button
              type="button"
              onClick={onVoid}
              // Same action, named for what the user is actually doing: refusing
              // a claim that never counted, versus reversing one that did.
              title={
                isPending
                  ? `Reject this ${meta.verb.toLowerCase()} for ${entry.materialName}`
                  : `Void ${meta.verb.toLowerCase()} entry for ${entry.materialName}`
              }
              className="rounded-md px-2 py-1 text-xs font-medium text-gray-400 transition-colors hover:bg-error-50 hover:text-error-600"
            >
              {isPending ? "Reject" : "Void"}
            </button>
          ) : null}
      </div>
    </div>
  );
}

LedgerRow.displayName = "LedgerRow";
