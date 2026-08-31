import { ChevronDown, ChevronRight, FileText, MapPin, MessageSquare, Play, Send, Trash2, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatClock, relativeTime } from "./plan-review-data";
import { KEY, NOTE_TYPE, type Note } from "./plan-review-types";
import { IconBtn } from "./plan-review-ui";

export function ReviewNotesPanel({
  open,
  onToggle,
  notes,
  recording,
  composer,
  onOpenNote,
  sheetCodeFor,
}: {
  open: boolean;
  onToggle: () => void;
  notes: { items: Note[]; commentCount: number; recordingCount: number };
  recording: {
    playProgress: number | null;
    onStart: () => void;
    onPlay: () => void;
    onClear: () => void;
  };
  composer: {
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    inputRef: React.RefObject<HTMLInputElement | null>;
    pinnedSheetCode: string | null;
  };
  onOpenNote: (note: Note) => void;
  sheetCodeFor: (sheetId: string) => string;
}) {
  return (
        <aside
          className={cn(
            "flex shrink-0 flex-col border-t border-[#F0F0F0] bg-white lg:border-l lg:border-t-0",
            open ? "max-h-[45dvh] lg:max-h-none lg:w-80" : "lg:w-12",
          )}
        >
          <div className="flex items-center gap-2 border-b border-[#F0F0F0] px-3 py-2.5">
            {open ? (
              <>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">Review Notes</p>
                  <p className="text-[11px] text-gray-500">
                    {notes.commentCount} note{notes.commentCount === 1 ? "" : "s"} · {notes.recordingCount} recording{notes.recordingCount === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={recording.onStart}
                  title="Record walkthrough"
                  className="ml-auto flex items-center gap-1 rounded-lg border border-[#EDEDED] px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-[#F6F6F6] hover:text-gray-900"
                >
                  <Video size={12} /> Record
                </button>
              </>
            ) : null}
            <IconBtn
              label={open ? "Collapse review notes" : "Expand review notes"}
              pressed={open}
              onClick={onToggle}
              className={open ? undefined : "mx-auto"}
            >
              {open ? <ChevronRight size={15} className="hidden lg:block" /> : <MessageSquare size={15} />}
              {open ? <ChevronDown size={15} className="lg:hidden" /> : null}
            </IconBtn>
          </div>

          {open && (
            <>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                {notes.items.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[#D9D9D9] bg-[#FAFAFA] px-4 py-8 text-center">
                    <MessageSquare size={20} className="text-gray-400" />
                    <p className="text-sm font-medium text-gray-900">No review notes yet</p>
                    <p className="text-xs text-gray-500">Drop a pin with the comment tool or record a walkthrough.</p>
                  </div>
                ) : (
                  notes.items.map((note) => (
                    <article key={note.id} className="rounded-xl border border-[#EDEDED] bg-[#FAFAFA] p-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white",
                            note.type === NOTE_TYPE.RECORDING ? "bg-red-600" : "bg-primary-600",
                          )}
                        >
                          {note.type === NOTE_TYPE.RECORDING ? <Video size={11} /> : note.author.charAt(0)}
                        </span>
                        <p className="text-xs font-semibold text-gray-900">
                          {note.author} <span className="font-normal text-gray-500">{relativeTime(note.createdAt)}</span>
                        </p>
                        {note.type === NOTE_TYPE.RECORDING && note.durationSeconds !== null && (
                          <span className="ml-auto rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-600">
                            {formatClock(note.durationSeconds)}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-xs text-gray-600">{note.text}</p>
                      {note.type === NOTE_TYPE.RECORDING ? (
                        <div className="mt-2 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={recording.onPlay}
                            disabled={recording.playProgress !== null}
                            className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                          >
                            <Play size={11} fill="currentColor" />
                            {recording.playProgress !== null ? "Playing…" : "Play Recording"}
                          </button>
                          <span className="text-[10px] text-gray-500">Voice + mouse movement</span>
                          <IconBtn label="Clear recording" onClick={recording.onClear} className="ml-auto size-7 text-gray-400 hover:text-red-600">
                            <Trash2 size={13} />
                          </IconBtn>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenNote(note)}
                          className="mt-2 flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 hover:bg-gray-200"
                        >
                          {note.pinId ? <MapPin size={10} /> : <FileText size={10} />}
                          {note.pinId ? "Pinned" : "Sheet"} · {sheetCodeFor(note.sheetId)}
                        </button>
                      )}
                    </article>
                  ))
                )}
              </div>

              <div className="flex items-center gap-2 border-t border-[#F0F0F0] p-3">
                {composer.pinnedSheetCode && (
                  <span className="flex shrink-0 items-center gap-1 rounded-md bg-primary-50 px-1.5 py-1 text-[10px] font-medium text-primary-700">
                    <MapPin size={10} /> {composer.pinnedSheetCode}
                  </span>
                )}
                <input
                  ref={composer.inputRef}
                  value={composer.value}
                  onChange={(e) => composer.onChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                    if (e.key === KEY.ENTER) composer.onSubmit();
                  }}
                  aria-label="Add a comment"
                  placeholder={composer.pinnedSheetCode ? "Describe the pinned spot…" : "Add a comment…"}
                  className="h-9 w-full min-w-0 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10"
                />
                <button
                  type="button"
                  aria-label="Send comment"
                  title="Send comment"
                  onClick={composer.onSubmit}
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-white hover:bg-primary-700"
                >
                  <Send size={15} />
                </button>
              </div>
            </>
          )}
        </aside>
  );
}

ReviewNotesPanel.displayName = "ReviewNotesPanel";
