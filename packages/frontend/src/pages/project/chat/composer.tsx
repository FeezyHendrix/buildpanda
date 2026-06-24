import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { uploadFileRequest } from "@/hooks/use-files";
import {
  readCachedDraft,
  saveCachedDraft,
  clearCachedDraft,
} from "@/lib/chat-cache";
import {
  SmileIcon,
  PlusCircleIcon,
  SendIcon,
  BoldIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  CodeIcon,
  AtSignIcon,
} from "@/components/atoms/chat-icons";
import { chatFileUrl } from "./chat-utils";
import { MentionDropdown } from "./mention-dropdown";
import { ReferencePicker } from "./reference-picker";
import { EmojiPopover } from "./emoji-popover";
import type { ChannelMemberLite } from "@/lib/project-types";
import {   useChannelMembers,
  useSendMessage,
} from "@/hooks/use-chat";

export function Composer({
  channelId,
  projectId,
  parentMessageId,
  isThread = false,
  placeholder = "Message #general",
}: {
  channelId: string;
  projectId: string;
  parentMessageId?: string;
  isThread?: boolean;
  placeholder?: string;
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

      const validMentions = mentions.filter(
        (m) =>
          m.kind === "user" &&
          m.userId &&
          members.find((mb) => mb.id === m.userId)?.name &&
          text.includes(`@${members.find((mb) => mb.id === m.userId)?.name}`)
      );

      send.mutate(
        { body: text.trim(), mentions: validMentions, references, attachments, parentMessageId },
        {
          onSuccess: () => {
            setText("");
            setMentions([]);
            setReferences([]);
            setAttachments([]);
            void clearCachedDraft(channelId, parentMessageId);
          },
        }
      );
    }
  };

  const handleMentionSelect = (m: ChannelMemberLite) => {
    if (!m.name) return;
    const newText = text.slice(0, atIndex) + `@${m.name} `;
    setText(newText);
    setMentions((prev) => [...prev, { kind: "user", userId: m.id }]);
  };

  const submitFromButton = () => {
    handleKeyDown({ key: "Enter", preventDefault: () => {}, shiftKey: false } as unknown as React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>);
  };

  return (
    <div className={cn("relative", isThread ? "" : "px-6 pb-3 pt-1")}>
      {showMentions && (
        <MentionDropdown
          members={members}
          query={mentionQuery}
          onSelect={handleMentionSelect}
        />
      )}
      {pickerOpen && (
        <ReferencePicker
          onSelect={(ref) => {
            if (!references.find(r => r.type === ref.type && r.id === ref.id)) {
              setReferences(prev => [...prev, ref]);
            }
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
      
      {references.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {references.map((r) => (
            <div key={`${r.type}-${r.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700">
              <span className="text-gray-400">{r.type}</span>
              {r.label}
              <button
                type="button"
                onClick={() => setReferences(prev => prev.filter(x => !(x.type === r.type && x.id === r.id)))}
                className="ml-0.5 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((a) => (
            <div key={a.fileId} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700">
              <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span className="max-w-[160px] truncate">{a.name}</span>
              <button
                type="button"
                onClick={() => setAttachments((prev) => prev.filter((x) => x.fileId !== a.fileId))}
                className="ml-0.5 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={cn(isThread ? "flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3" : "overflow-hidden rounded-xl border border-gray-200 bg-white")}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        {isThread ? (
          <>
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Reply..."
              className="flex-1 bg-transparent text-[13px] text-black-500 outline-none placeholder:text-gray-400"
            />
            <div className="relative">
              <button
                type="button"
                onClick={() => setEmojiOpen((v) => !v)}
                className="flex size-7 items-center justify-center rounded-md text-gray-400 transition-[color,transform] duration-150 ease-out hover:bg-gray-100 hover:text-gray-700 active:scale-90 motion-reduce:transition-none motion-reduce:active:scale-100"
                aria-label="Insert emoji"
              >
                <SmileIcon className="size-5" />
              </button>
              <EmojiPopover
                open={emojiOpen}
                onClose={() => setEmojiOpen(false)}
                onPick={(emoji) => { insertEmoji(emoji); setEmojiOpen(false); }}
              />
            </div>
            <button
              type="button"
              onClick={submitFromButton}
              disabled={(!text.trim() && references.length === 0 && attachments.length === 0) || send.isPending}
              className="text-primary-500 transition-[color,transform] duration-150 ease-out hover:text-primary-600 active:scale-90 disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
              aria-label="Send reply"
            >
              <SendIcon className="size-5" />
            </button>
          </>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-1 border-b border-gray-100 px-3 py-2">
              {[BoldIcon, ItalicIcon, LinkIcon, ListIcon, CodeIcon].map((Icon, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled
                  className="flex size-8 items-center justify-center rounded-md text-gray-400 disabled:opacity-60"
                >
                  <Icon />
                </button>
              ))}
            </div>

            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="max-h-56 min-h-[88px] w-full resize-none px-4 py-3 text-[13px] leading-relaxed text-black-500 outline-none placeholder:text-gray-400"
              rows={3}
            />

            <div className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  title="Attach files"
                  className="flex size-8 items-center justify-center rounded-md text-gray-500 transition-[color,transform] duration-150 ease-out hover:bg-gray-100 hover:text-gray-700 active:scale-90 disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
                >
                  <PlusCircleIcon />
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setEmojiOpen((v) => !v)}
                    title="Insert emoji"
                    aria-label="Insert emoji"
                    className="flex size-8 items-center justify-center rounded-md text-gray-500 transition-[color,transform] duration-150 ease-out hover:bg-gray-100 hover:text-gray-700 active:scale-90 motion-reduce:transition-none motion-reduce:active:scale-100"
                  >
                    <SmileIcon />
                  </button>
                  <EmojiPopover
                    open={emojiOpen}
                    onClose={() => setEmojiOpen(false)}
                    onPick={(emoji) => { insertEmoji(emoji); setEmojiOpen(false); }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setText((current) => `${current}@`)}
                  className="flex size-8 items-center justify-center rounded-md text-gray-500 transition-[color,transform] duration-150 ease-out hover:bg-gray-100 hover:text-gray-700 active:scale-90 motion-reduce:transition-none motion-reduce:active:scale-100"
                  title="Mention someone"
                >
                  <AtSignIcon />
                </button>
                <button
                  type="button"
                  onClick={() => setPickerOpen(!pickerOpen)}
                  className="flex size-8 items-center justify-center rounded-md text-gray-500 transition-[color,transform] duration-150 ease-out hover:bg-gray-100 hover:text-gray-700 active:scale-90 motion-reduce:transition-none motion-reduce:active:scale-100"
                  title="Reference project item"
                >
                  <LinkIcon className="size-5" />
                </button>
              </div>
              <button
                type="button"
                onClick={submitFromButton}
                disabled={(!text.trim() && references.length === 0 && attachments.length === 0) || send.isPending}
                className="flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white transition-[background-color,transform] duration-150 ease-out hover:bg-primary-600 active:scale-95 disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                Send
                <SendIcon />
              </button>
            </div>

          </div>
        )}
      </div>
      {!isThread && (
        <p className="mt-2 text-center text-xs text-gray-500">
          <span className="font-semibold">Return</span> to send, <span className="font-semibold">Shift + Return</span> for new line
        </p>
      )}
    </div>
  );
}


