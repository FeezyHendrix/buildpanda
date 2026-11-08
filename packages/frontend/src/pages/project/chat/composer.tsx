import { useState, useRef, useEffect } from "react";
import { AtSign, Link, Plus, Send, Smile } from "lucide-react";
import { toast } from "@/lib/toast";
import { uploadFileRequest } from "@/hooks/use-files";
import {
  readCachedDraft,
  saveCachedDraft,
  clearCachedDraft,
} from "@/lib/chat-cache";
import { SmileIcon, SendIcon } from "@/components/atoms/chat-icons";
import { chatFileUrl } from "./chat-utils";
import { MentionDropdown, type MentionOption } from "./mention-dropdown";
import { ReferencePicker } from "./reference-picker";
import { EmojiPopover } from "./emoji-popover";
import { ComposerPreviews } from "./composer-previews";
import { useChannelMembers, useSendMessage } from "@/hooks/use-chat";
import type { ChatMessage } from "@/lib/project-types";

const MAX_FIELD_HEIGHT = 160;
const TOOL_BUTTON_CLASS =
  "flex size-[36px] shrink-0 items-center justify-center text-[#4D4D4D] outline-none transition-[color,transform] duration-150 ease-out hover:text-[#1E1E1E] focus-visible:ring-2 focus-visible:ring-gray-900/10 active:scale-90 disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100";

export function Composer({
  channelId,
  projectId,
  parentMessageId,
  isThread = false,
  placeholder = "send a message",
  quotedMessage = null,
  onClearQuote,
}: {
  channelId: string;
  projectId: string;
  parentMessageId?: string;
  isThread?: boolean;
  placeholder?: string;
  quotedMessage?: ChatMessage | null;
  onClearQuote?: () => void;
}) {
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<{ kind: "user" | "here" | "channel"; userId?: string }[]>([]);
  const [references, setReferences] = useState<{ type: string; id: string; label: string }[]>([]);
  const [attachments, setAttachments] = useState<{ fileId: string; url: string; name: string; mime?: string; size?: number }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const { data: members = [] } = useChannelMembers(channelId);
  const send = useSendMessage(projectId, channelId);

  const insertEmoji = (emoji: string) => {
    const field = isThread ? inputRef.current : textareaRef.current;
    if (!field) {
      setText((current) => `${current}${emoji}`);
      return;
    }
    const start = field.selectionStart ?? text.length;
    const end = field.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      field.focus();
      const caret = start + emoji.length;
      field.setSelectionRange(caret, caret);
    });
  };

  useEffect(() => {
    let cancelled = false;
    void readCachedDraft(channelId, parentMessageId).then((draft) => {
      if (!cancelled) setText(draft);
    });
    return () => {
      cancelled = true;
    };
  }, [channelId, parentMessageId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void saveCachedDraft(channelId, parentMessageId, text);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [channelId, parentMessageId, text]);

  // The box grows with what is typed, up to a few lines, and shrinks back after a send.
  useEffect(() => {
    const field = textareaRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, MAX_FIELD_HEIGHT)}px`;
  }, [text]);

  const handleFiles = async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const uploaded = await uploadFileRequest(file);
        setAttachments((prev) => [
          ...prev,
          { fileId: uploaded.id, url: chatFileUrl(uploaded.id), name: uploaded.fileName, mime: file.type, size: file.size },
        ]);
      }
    } catch {
      toast("Could not upload file");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const atIndex = text.lastIndexOf("@");
  const showMentions = atIndex !== -1 && !text.slice(atIndex).includes(" ");
  const mentionQuery = showMentions ? text.slice(atIndex + 1) : "";

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if ((!text.trim() && references.length === 0 && attachments.length === 0) || send.isPending) return;

      const validMentions = mentions.filter((m) => {
        if (m.kind === "here") return text.includes("@project-team");
        if (m.kind === "channel") return text.includes("@company");
        return Boolean(
          m.userId &&
            members.find((mb) => mb.id === m.userId)?.name &&
            text.includes(`@${members.find((mb) => mb.id === m.userId)?.name}`),
        );
      });

      send.mutate(
        {
          body: text.trim(),
          mentions: validMentions,
          references,
          attachments,
          parentMessageId,
          quotedMessageId: quotedMessage?.id,
        },
        {
          onSuccess: () => {
            setText("");
            setMentions([]);
            setReferences([]);
            setAttachments([]);
            onClearQuote?.();
            void clearCachedDraft(channelId, parentMessageId);
          },
        }
      );
    }
  };

  const handleMentionSelect = (option: MentionOption) => {
    if (option.kind === "user") {
      if (!option.member.name) return;
      const newText = text.slice(0, atIndex) + `@${option.member.name} `;
      setText(newText);
      setMentions((prev) => [...prev, { kind: "user", userId: option.member.id }]);
      return;
    }
    const newText = text.slice(0, atIndex) + `@${option.label} `;
    setText(newText);
    setMentions((prev) => [...prev, { kind: option.kind }]);
  };

  const submitFromButton = () => {
    handleKeyDown({ key: "Enter", preventDefault: () => {}, shiftKey: false } as unknown as React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>);
  };

  const canSend = Boolean(text.trim() || references.length > 0 || attachments.length > 0) && !send.isPending;
  const previews = (
    <ComposerPreviews
      quotedMessage={quotedMessage}
      onClearQuote={onClearQuote}
      references={references}
      onRemoveReference={(ref) => setReferences((prev) => prev.filter((x) => !(x.type === ref.type && x.id === ref.id)))}
      attachments={attachments}
      onRemoveAttachment={(fileId) => setAttachments((prev) => prev.filter((x) => x.fileId !== fileId))}
    />
  );
  const overlays = (
    <>
      {showMentions && <MentionDropdown members={members} query={mentionQuery} onSelect={handleMentionSelect} />}
      {pickerOpen && (
        <ReferencePicker
          onSelect={(ref) => {
            if (!references.find((r) => r.type === ref.type && r.id === ref.id)) {
              setReferences((prev) => [...prev, ref]);
            }
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
  const fileInput = (
    <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => void handleFiles(e.target.files)} />
  );
  const emojiPicker = (
    <EmojiPopover
      open={emojiOpen}
      onClose={() => setEmojiOpen(false)}
      onPick={(emoji) => {
        insertEmoji(emoji);
        setEmojiOpen(false);
      }}
    />
  );

  if (!isThread) {
    return (
      <div className="relative pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:pb-[24px]">
        {overlays}
        <div className="bg-[#F5F5F5]">
          {quotedMessage || references.length > 0 || attachments.length > 0 ? (
            <div className="px-[16px] pt-[10px]">{previews}</div>
          ) : null}
          <div className="flex items-end gap-[8px] py-[11px] pl-[8px] pr-[15px]">
            {fileInput}
            <div className="mr-[8px] hidden shrink-0 items-center sm:flex">
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Attach files" aria-label="Attach files" className={TOOL_BUTTON_CLASS}>
                <Plus className="size-[18px]" strokeWidth={1.5} />
              </button>
              <div className="relative">
                <button type="button" onClick={() => setEmojiOpen((v) => !v)} title="Insert emoji" aria-label="Insert emoji" className={TOOL_BUTTON_CLASS}>
                  <Smile className="size-[18px]" strokeWidth={1.5} />
                </button>
                {emojiPicker}
              </div>
              <button type="button" onClick={() => setText((current) => `${current}@`)} title="Mention someone" aria-label="Mention someone" className={TOOL_BUTTON_CLASS}>
                <AtSign className="size-[18px]" strokeWidth={1.5} />
              </button>
              <button type="button" onClick={() => setPickerOpen(!pickerOpen)} title="Reference project item" aria-label="Reference project item" className={TOOL_BUTTON_CLASS}>
                <Link className="size-[18px]" strokeWidth={1.5} />
              </button>
            </div>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              aria-label="Message"
              rows={1}
              className="min-h-[36px] min-w-0 flex-1 resize-none border border-[#EEEEEE] bg-white px-[15px] py-[7px] text-[14px] leading-[20px] text-[#1E1E1E] outline-none placeholder:text-[#A5A5A5] focus:border-primary"
            />
            <button
              type="button"
              onClick={submitFromButton}
              disabled={!canSend}
              aria-label="Send message"
              className="flex size-[36px] shrink-0 items-center justify-center bg-primary text-white outline-none transition-colors hover:bg-[#0041C4] focus-visible:ring-2 focus-visible:ring-gray-900/30 disabled:opacity-50"
            >
              <Send className="size-[18px]" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {overlays}
      {previews}
      <div className="flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-3">
        {fileInput}
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Reply..."
          className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
        />
        <div className="relative">
          <button
            type="button"
            onClick={() => setEmojiOpen((v) => !v)}
            className="flex size-7 items-center justify-center rounded-md text-ink-muted transition-[color,transform] duration-150 ease-out hover:bg-black/5 hover:text-ink active:scale-90 motion-reduce:transition-none motion-reduce:active:scale-100"
            aria-label="Insert emoji"
          >
            <SmileIcon className="size-5" />
          </button>
          {emojiPicker}
        </div>
        <button
          type="button"
          onClick={submitFromButton}
          disabled={!canSend}
          className="text-primary-500 transition-[color,transform] duration-150 ease-out hover:text-primary-600 active:scale-90 disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
          aria-label="Send reply"
        >
          <SendIcon className="size-5" />
        </button>
      </div>
    </div>
  );
}
