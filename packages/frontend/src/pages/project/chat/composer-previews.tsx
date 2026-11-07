import type { ChatMessage } from "@/lib/project-types";
import { QuotedBlock } from "./quoted-block";

type DraftReference = { type: string; id: string; label: string };
type DraftAttachment = { fileId: string; url: string; name: string; mime?: string; size?: number };

/** What is queued on the message being written: the quote, linked items and files. */
export function ComposerPreviews({
  quotedMessage,
  onClearQuote,
  references,
  onRemoveReference,
  attachments,
  onRemoveAttachment,
}: {
  quotedMessage: ChatMessage | null;
  onClearQuote?: () => void;
  references: DraftReference[];
  onRemoveReference: (ref: DraftReference) => void;
  attachments: DraftAttachment[];
  onRemoveAttachment: (fileId: string) => void;
}) {
  return (
    <>
      {quotedMessage && (
        <div className="mb-2 flex items-center gap-2">
          <QuotedBlock
            quoted={{
              id: quotedMessage.id,
              authorName: quotedMessage.authorName,
              body: quotedMessage.body,
              deleted: Boolean(quotedMessage.deletedAt),
            }}
          />
          <button
            type="button"
            onClick={onClearQuote}
            className="shrink-0 text-ink-muted hover:text-ink"
            aria-label="Remove quote"
          >
            ×
          </button>
        </div>
      )}

      {references.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {references.map((r) => (
            <div
              key={`${r.type}-${r.id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-line-hair bg-white px-2.5 py-1 text-xs font-medium text-ink"
            >
              <span className="text-ink-muted">{r.type}</span>
              {r.label}
              <button type="button" onClick={() => onRemoveReference(r)} className="ml-0.5 text-ink-muted hover:text-ink">
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((a) => (
            <div
              key={a.fileId}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line-hair bg-white px-2.5 py-1.5 text-xs font-medium text-ink"
            >
              <svg className="h-3.5 w-3.5 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span className="max-w-[160px] truncate">{a.name}</span>
              <button type="button" onClick={() => onRemoveAttachment(a.fileId)} className="ml-0.5 text-ink-muted hover:text-ink">
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

ComposerPreviews.displayName = "ComposerPreviews";
