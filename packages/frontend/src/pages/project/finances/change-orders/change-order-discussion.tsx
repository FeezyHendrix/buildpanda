import { useRef, useState } from "react";
import { Reply } from "lucide-react";
import { ReactSVG } from "react-svg";
import { icons2 } from "@/assets/icons2/icon2";
import { Button } from "@/components/atoms/button";
import { FileLink } from "@/components/molecules/image-attach";
import { useAddChangeComment } from "@/hooks/use-change-requests";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import type { ChangeRequestDetail } from "@/lib/project-types";
import { initialsOf } from "./change-order-model";

function CommentRow({ authorName, body, onReply }: { authorName: string; body: string; onReply: (name: string) => void }) {
  return (
    <li className="flex gap-[12px]">
      <span
        aria-hidden
        className="flex size-[32px] shrink-0 items-center justify-center rounded-full border border-[#B9CCFA] bg-[#EEF3FF] text-caption-m font-semibold text-[#004DE7]"
      >
        {initialsOf(authorName)}
      </span>
      <div className="min-w-0 flex-1 bg-[#F4F4F4] px-[12px] pb-[9px] pt-[7px]">
        <p className="text-caption-m font-semibold leading-[16px] text-[#1E1E1E]">{authorName}</p>
        <p className="mt-[4px] whitespace-pre-wrap text-caption-m leading-[16px] text-[#737373]">{body}</p>
        <button
          type="button"
          onClick={() => onReply(authorName)}
          className="mt-[21px] flex w-fit items-center gap-[6px] text-caption-m leading-[16px] text-[#737373] outline-none hover:text-[#1E1E1E] focus-visible:text-[#1E1E1E]"
        >
          <Reply className="size-[16px]" strokeWidth={1.5} aria-hidden />
          Reply
        </button>
      </div>
    </li>
  );
}

CommentRow.displayName = "CommentRow";

/**
 * The conversation on a change order. A reply tags the person it answers; the
 * API has no threads, so it is a new comment that opens with their name. Images
 * are picked but not sent (docs/change-orders-backend.md).
 */
export function ChangeOrderDiscussion({ projectId, cr }: { projectId: string; cr: ChangeRequestDetail }) {
  const addComment = useAddChangeComment();
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [images, setImages] = useState<File[]>([]);

  function post(): void {
    const content = text.trim();
    if (!content) return;
    addComment.mutate(
      { projectId, changeId: cr.id, body: { content } },
      {
        onSuccess: () => {
          setText("");
          setImages([]);
        },
        onError: (error) => toast(getApiErrorMessage(error), "error"),
      },
    );
  }

  function reply(name: string): void {
    setText((current) => (current.trim() ? current : `@${name.split(" ")[0]} `));
    inputRef.current?.focus();
  }

  return (
    <section className="flex flex-col gap-[16px]">
      <h3 className="text-[16px] font-semibold leading-[24px] text-[#1E1E1E]">Discussions</h3>
      {cr.comments.length === 0 ? (
        <p className="text-caption-l text-[#737373]">No comments yet.</p>
      ) : (
        <ul className="flex flex-col gap-[4px]">
          {cr.comments.map((comment) => (
            <CommentRow key={comment.id} authorName={comment.authorName} body={comment.body} onReply={reply} />
          ))}
        </ul>
      )}

      <div className="mt-[10px] flex items-center gap-[13px]">
        <input
          ref={inputRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              post();
            }
          }}
          placeholder="Write comment"
          aria-label="Write a comment"
          className="h-[36px] min-w-0 flex-1 border border-[#EEEEEE] bg-white px-[16px] text-caption-l text-[#1E1E1E] outline-none placeholder:text-[#B0B0B0] focus:border-[#004DE7]"
        />
        <button
          type="button"
          aria-label="Attach image"
          onClick={() => fileRef.current?.click()}
          className="flex h-[36px] w-[47px] shrink-0 items-center justify-center border border-[#E0E0E0] bg-white outline-none hover:bg-[#F6F6F6] focus-visible:ring-2 focus-visible:ring-[#004DE7]/25"
        >
          <ReactSVG src={icons2.image} className="flex [&_svg]:size-[18px]" aria-hidden />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          tabIndex={-1}
          onChange={(event) => {
            if (event.target.files) setImages((current) => [...current, ...Array.from(event.target.files!)]);
            event.target.value = "";
          }}
        />
        <Button type="button" className="h-[36px] px-[16px] text-caption-l" disabled={!text.trim()} loading={addComment.isPending} onClick={post}>
          Post
        </Button>
      </div>
      {images.length > 0 ? (
        <div className="flex flex-wrap gap-x-[16px] gap-y-[8px]">
          {images.map((file, index) => (
            <FileLink key={`${file.name}-${index}`} file={file} onRemove={() => setImages((current) => current.filter((_, i) => i !== index))} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

ChangeOrderDiscussion.displayName = "ChangeOrderDiscussion";
