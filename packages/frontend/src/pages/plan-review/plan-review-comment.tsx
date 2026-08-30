import { useEffect, useRef, useState } from "react";
import {
  Check,
  ClipboardCheck,
  ListTodo,
  MessageSquare,
  Mic,
  Square,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { Spinner } from "@/components/atoms/spinner";
import { cn } from "@/lib/utils";
import { formatClock } from "./plan-review-data";

export type CommentMode = "text" | "audio" | "video";
export type FollowUpKind = "none" | "rfi" | "approval" | "task";

export interface CommentCapture {
  text: string;
  mode: CommentMode;
  mediaUrl: string | null;
  mediaDurationSeconds: number | null;
  assigneeId: string | null;
  assigneeName: string | null;
  followUp: FollowUpKind;
}

export interface CommentAssignee {
  id: string;
  name: string;
}

const FOLLOW_UPS: { id: FollowUpKind; label: string }[] = [
  { id: "none", label: "Comment only" },
  { id: "rfi", label: "Raise an RFI" },
  { id: "approval", label: "Request approval" },
  { id: "task", label: "Create a task" },
];

export const FOLLOW_UP_META: Record<
  Exclude<FollowUpKind, "none">,
  { label: string; Icon: typeof MessageSquare }
> = {
  rfi: { label: "RFI", Icon: MessageSquare },
  approval: { label: "Approval", Icon: ClipboardCheck },
  task: { label: "Task", Icon: ListTodo },
};

/** Teardrop marker carrying a comment glyph, so pins read as comments at a glance. */
export function CommentPin({
  color,
  label,
  selected,
  draggable,
  onPointerDown,
  onClick,
  style,
}: {
  color: string;
  label: string;
  selected: boolean;
  draggable: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}) {
  return (
    <span
      title={label}
      onPointerDown={onPointerDown}
      onClick={onClick}
      style={style}
      className={cn(
        "absolute flex size-7 -translate-x-1/2 -translate-y-full items-center justify-center",
        "rounded-full rounded-bl-sm border-2 border-white text-white shadow-lg",
        draggable && "cursor-move",
        selected && "ring-2 ring-primary-500 ring-offset-1",
      )}
    >
      <span className="absolute inset-0 rounded-full rounded-bl-sm" style={{ backgroundColor: color }} />
      <MessageSquare size={13} className="relative" strokeWidth={2.5} />
    </span>
  );
}

CommentPin.displayName = "CommentPin";

function ModeTab({
  active,
  onClick,
  Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  Icon: typeof Mic;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900",
      )}
    >
      <Icon size={13} /> {label}
    </button>
  );
}

export function CommentComposerPopover({
  anchor,
  assignees,
  color,
  busy,
  onCancel,
  onSubmit,
}: {
  anchor: { x: number; y: number };
  assignees: CommentAssignee[];
  color: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (capture: CommentCapture) => void;
}) {
  const [mode, setMode] = useState<CommentMode>("text");
  const [text, setText] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [followUp, setFollowUp] = useState<FollowUpKind>("none");

  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const previewRef = useRef<HTMLVideoElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (mode === "text") textRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [recording]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  function resetMedia(): void {
    setMediaUrl(null);
    setSeconds(0);
    setMediaError(null);
  }

  async function startRecording(): Promise<void> {
    resetMedia();
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        mode === "video" ? { audio: true, video: true } : { audio: true },
      );
      streamRef.current = stream;
      if (mode === "video" && previewRef.current) {
        previewRef.current.srcObject = stream;
        await previewRef.current.play().catch(() => undefined);
      }
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        setMediaUrl(URL.createObjectURL(new Blob(chunksRef.current, { type: recorder.mimeType })));
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      setMediaError(
        mode === "video"
          ? "Camera unavailable — check browser permissions."
          : "Microphone unavailable — check browser permissions.",
      );
    }
  }

  function stopRecording(): void {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  function handleSubmit(): void {
    const trimmed = text.trim();
    if (!trimmed && !mediaUrl) return;
    const assignee = assignees.find((a) => a.id === assigneeId) ?? null;
    onSubmit({
      text: trimmed || (mode === "video" ? "Video note" : "Voice note"),
      mode,
      mediaUrl,
      mediaDurationSeconds: mediaUrl ? seconds : null,
      assigneeId: assignee?.id ?? null,
      assigneeName: assignee?.name ?? null,
      followUp,
    });
  }

  const canSubmit = Boolean(text.trim() || mediaUrl) && !recording && !busy;

  return (
    <div
      data-comment-popover
      style={{ left: anchor.x, top: anchor.y }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="fixed z-[60] w-[320px] -translate-x-1/2 rounded-2xl bg-white p-3 shadow-xl ring-1 ring-black/10"
    >
      <div className="flex items-center gap-2">
        <span
          className="flex size-6 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: color }}
        >
          <MessageSquare size={12} strokeWidth={2.5} />
        </span>
        <p className="text-sm font-semibold text-gray-900">Add comment</p>
        <button
          type="button"
          aria-label="Cancel comment"
          title="Cancel comment"
          onClick={onCancel}
          className="ml-auto flex size-7 items-center justify-center rounded-lg text-gray-400 hover:bg-[#F6F6F6] hover:text-gray-700"
        >
          <X size={14} />
        </button>
      </div>

      <div
        className="mt-2.5 flex rounded-lg border border-[#EDEDED] bg-[#F6F6F6] p-0.5"
        role="group"
        aria-label="Comment type"
      >
        <ModeTab active={mode === "text"} onClick={() => { setMode("text"); resetMedia(); }} Icon={MessageSquare} label="Note" />
        <ModeTab active={mode === "audio"} onClick={() => { setMode("audio"); resetMedia(); }} Icon={Mic} label="Audio" />
        <ModeTab active={mode === "video"} onClick={() => { setMode("video"); resetMedia(); }} Icon={Video} label="Video" />
      </div>

      <label htmlFor="comment-text" className="sr-only">
        Comment
      </label>
      <textarea
        id="comment-text"
        ref={textRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing || e.keyCode === 229) return;
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
        }}
        rows={mode === "text" ? 3 : 2}
        placeholder={mode === "text" ? "What needs attention here?" : "Add a caption (optional)"}
        className="mt-2.5 w-full resize-none rounded-lg bg-[#F6F6F6] px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10"
      />

      {mode !== "text" && (
        <div className="mt-2 rounded-lg border border-[#EDEDED] p-2.5">
          {mode === "video" && (recording || mediaUrl) && (
            <video
              ref={previewRef}
              src={mediaUrl ?? undefined}
              controls={Boolean(mediaUrl)}
              muted={recording}
              playsInline
              className="mb-2 aspect-video w-full rounded-md bg-gray-900 object-cover"
            />
          )}
          {mode === "audio" && mediaUrl && <audio src={mediaUrl} controls className="mb-2 w-full" />}

          <div className="flex items-center gap-2">
            {recording ? (
              <button
                type="button"
                onClick={stopRecording}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
              >
                <Square size={11} fill="currentColor" /> Stop · {formatClock(seconds)}
              </button>
            ) : mediaUrl ? (
              <>
                <span className="flex items-center gap-1.5 text-xs font-medium text-green-700">
                  <Check size={13} /> {mode === "video" ? "Video" : "Audio"} captured · {formatClock(seconds)}
                </span>
                <button
                  type="button"
                  onClick={resetMedia}
                  className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-gray-500 hover:bg-[#F6F6F6] hover:text-red-600"
                >
                  <Trash2 size={11} /> Discard
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void startRecording()}
                className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-700"
              >
                {mode === "video" ? <Video size={12} /> : <Mic size={12} />}
                Record {mode === "video" ? "video" : "audio"}
              </button>
            )}
            {recording && <span className="size-2 animate-pulse rounded-full bg-red-500" />}
          </div>

          {mediaError && <p className="mt-1.5 text-[11px] text-amber-700">{mediaError}</p>}
        </div>
      )}

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="comment-assignee" className="mb-1 block text-[11px] font-medium text-gray-500">
            Assign to
          </label>
          <select
            id="comment-assignee"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="h-8 w-full rounded-lg bg-[#F6F6F6] px-2 text-xs text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
          >
            <option value="">Nobody</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="comment-followup" className="mb-1 block text-[11px] font-medium text-gray-500">
            Follow-up
          </label>
          <select
            id="comment-followup"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value as FollowUpKind)}
            className="h-8 w-full rounded-lg bg-[#F6F6F6] px-2 text-xs text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
          >
            {FOLLOW_UPS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <p className="text-[10px] text-gray-400">⌘↵ to save</p>
        <button
          type="button"
          onClick={onCancel}
          className="ml-auto rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-[#F6F6F6]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {busy ? <Spinner size="xs" tone="current" /> : null}
          Save comment
        </button>
      </div>
    </div>
  );
}

CommentComposerPopover.displayName = "CommentComposerPopover";

export function MediaNotePlayer({ url, mode }: { url: string; mode: CommentMode }) {
  if (mode === "video") {
    return <video src={url} controls playsInline className="mt-2 w-full rounded-md bg-gray-900" />;
  }
  return <audio src={url} controls className="mt-2 w-full" />;
}

MediaNotePlayer.displayName = "MediaNotePlayer";
