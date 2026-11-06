import { useState } from "react";
import { Avatar } from "@/components/atoms/avatar";
import { Button } from "@/components/atoms/button";
import { RichTextEditor, type UploadedAttachment } from "@/components/molecules/rich-text-editor";
import { useRespondRfi } from "@/hooks/use-rfis";
import { formatClockTime, formatShortDate } from "@/lib/formatters";
import type { RfiComment, RfiDetail } from "@/lib/project-types";
import { ReferenceChips, ReferencePicker, type RfiReference } from "./reference-picker";

const PROSE =
  "prose prose-sm max-w-none text-[12px] leading-[16px] text-[#1E1E1E] prose-p:my-0 prose-ul:my-1 prose-ol:my-1 prose-ul:list-disc prose-ol:list-decimal [&_img]:max-h-64 [&_img]:rounded";

/** Today's responses show the time alone; older ones say which day. */
function responseStamp(iso: string): string {
  const when = new Date(iso);
  const now = new Date();
  const sameDay = when.toDateString() === now.toDateString();
  return sameDay ? formatClockTime(iso) : `${formatShortDate(iso).replace(/ \d{4}$/, "")}, ${formatClockTime(iso)}`;
}

function ResponseItem({ comment }: { comment: RfiComment }) {
  return (
    <article className="flex flex-col gap-[8px]">
      <div className="flex h-[24px] items-center gap-[8px]">
        <Avatar name={comment.authorName} className="size-[24px] bg-primary text-[10px] text-white" />
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold leading-[16px] text-[#1E1E1E]">{comment.authorName}</span>
        {comment.isProposedResponse ? (
          <span className="shrink-0 text-[11px] font-medium text-[#E17100]">Proposed</span>
        ) : null}
        <time dateTime={comment.createdAt} className="shrink-0 text-[12px] leading-[16px] text-[#ACACAC]">
          {responseStamp(comment.createdAt)}
        </time>
      </div>
      {comment.contentHtml ? (
        <div className={PROSE} dangerouslySetInnerHTML={{ __html: comment.contentHtml }} />
      ) : (
        <p className="whitespace-pre-wrap text-[12px] leading-[16px] text-[#1E1E1E]">{comment.body}</p>
      )}
      {comment.references && comment.references.length > 0 ? (
        <ReferenceChips references={comment.references as RfiReference[]} />
      ) : null}
    </article>
  );
}

/** The conversation on an RFI, the official answer when there is one, and the box to add to it. */
export function RfiResponses({
  rfi,
  projectId,
  canRespond,
  canManage,
  closed,
}: {
  rfi: RfiDetail;
  projectId: string;
  canRespond: boolean;
  canManage: boolean;
  /** Closed and void RFIs take no new responses: the box stays, read-only. */
  closed: boolean;
}) {
  const respond = useRespondRfi();
  const [html, setHtml] = useState("");
  const [text, setText] = useState("");
  const [official, setOfficial] = useState(false);
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [references, setReferences] = useState<RfiReference[]>([]);
  const [editorKey, setEditorKey] = useState(0);

  function resetEditor(): void {
    setHtml("");
    setText("");
    setOfficial(false);
    setAttachments([]);
    setReferences([]);
    setEditorKey((k) => k + 1);
  }

  function submit(): void {
    if (text.trim() === "") return;
    respond.mutate(
      { projectId, rfiId: rfi.id, body: text, contentHtml: html, official: official && canManage, attachments, references },
      { onSuccess: resetEditor },
    );
  }

  const postingOfficial = official && canManage;

  return (
    <section aria-label="Responses" className="flex min-h-[320px] flex-1 flex-col bg-[#F5F5F5] px-[24px] pb-[24px] pt-[40px] lg:min-h-0">
      <h2 className="text-[18px] font-bold leading-[28px] text-[#111111]">Responses</h2>

      <div className="mt-[22px] flex min-h-0 flex-1 flex-col gap-[24px] overflow-y-auto no-scrollbar">
        {rfi.officialResponse ? (
          <div className="border border-[#D6E2FB] bg-[#E6EDFD] p-[12px]">
            <p className="text-[12px] font-semibold leading-[16px] text-[#004DE7]">Official response</p>
            {rfi.officialResponseHtml ? (
              <div className={`${PROSE} mt-[6px]`} dangerouslySetInnerHTML={{ __html: rfi.officialResponseHtml }} />
            ) : (
              <p className="mt-[6px] whitespace-pre-wrap text-[12px] leading-[16px] text-[#1E1E1E]">{rfi.officialResponse}</p>
            )}
            {rfi.officialRespondedByName ? (
              <p className="mt-[6px] text-[12px] leading-[16px] text-[#737373]">
                {rfi.officialRespondedByName}
                {rfi.officialRespondedAt ? ` · ${formatShortDate(rfi.officialRespondedAt)}` : ""}
              </p>
            ) : null}
          </div>
        ) : null}

        {rfi.comments.length === 0 ? (
          <p className="text-[12px] leading-[16px] text-[#737373]">No responses yet.</p>
        ) : (
          rfi.comments.map((c) => <ResponseItem key={c.id} comment={c} />)
        )}
      </div>

      {canRespond ? (
        <div className="mt-[16px] flex flex-col gap-[8px]">
          {closed ? (
            <p role="status" className="text-[12px] leading-[16px] text-[#737373]">
              This RFI is closed. Reopen it to add a response.
            </p>
          ) : (
            <>
              <ReferenceChips
                references={references}
                onRemove={(index) => setReferences((prev) => prev.filter((_, j) => j !== index))}
              />
              <div className="flex flex-wrap items-center gap-[12px] text-[12px] text-[#1E1E1E]">
                <ReferencePicker projectId={projectId} onPick={(ref) => setReferences((prev) => [...prev, ref])} />
                {canManage ? (
                  <label className="flex items-center gap-[8px]">
                    <input type="checkbox" checked={official} onChange={(e) => setOfficial(e.target.checked)} />
                    Post as the official response
                  </label>
                ) : null}
              </div>
            </>
          )}
          <RichTextEditor
            key={editorKey}
            variant="panel"
            value={html}
            onChange={(h, t) => {
              setHtml(h);
              setText(t);
            }}
            onAttach={(a) => setAttachments((prev) => [...prev, a])}
            projectId={projectId}
            placeholder="Add a comment"
            disabled={closed}
            footer={
              <Button
                type="button"
                variant="primary"
                onClick={submit}
                loading={respond.isPending}
                disabled={closed || text.trim() === ""}
                className="h-[32px] px-[14px] text-[12px]"
              >
                {postingOfficial ? "Post Official Response" : "Add Comment"}
              </Button>
            }
          />
        </div>
      ) : null}
    </section>
  );
}

RfiResponses.displayName = "RfiResponses";
