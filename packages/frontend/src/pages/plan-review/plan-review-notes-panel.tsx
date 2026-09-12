import { ChevronDown, ChevronRight, FileText, MapPin, MessageSquare, Play, Send, Trash2, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatClock, relativeTime } from "./plan-review-data";
import { KEY, NOTE_TYPE, type Note } from "./plan-review-types";
import { IconBtn } from "./plan-review-ui";
import { INPUT_SM_CLASS } from "@/components/atoms/input";
import { Button } from "@/components/atoms/button";

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
            "flex shrink-0 flex-col border-t border-line-hair bg-white lg:border-l lg:border-t-0",
            open ? "max-h-[45dvh] lg:max-h-none lg:w-80" : "lg:w-12",
          )}
        >
          <div className="flex items-center gap-2 border-b border-line-hair px-3 py-2.5">
            {open ? (
              <>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">Review Notes</p>
                  <p className="text-xs text-gray-500">
                    {notes.commentCount} note{notes.commentCount === 1 ? "" : "s"} · {notes.recordingCount} recording{notes.recordingCount === 1 ? "" : "s"}
                  </p>
                </div>
                <Button variant="secondary" size="sm" className="ml-auto" onClick={recording.onStart} title="Record walkthrough">
                  <Video size={12} /> Record
                </Button>
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
                  <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line bg-surface-alt px-4 py-8 text-center">
                    <MessageSquare size={20} className="text-gray-400" />
                    <p className="text-sm font-medium text-gray-900">No review notes yet</p>
                    <p className="text-xs text-gray-500">Drop a pin with the comment tool or record a walkthrough.</p>
                  </div>
                ) : (
                  notes.items.map((note) => (
                    <article key={note.id} className="rounded-lg border border-line-hair bg-surface-alt p-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-white",
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
                          <Button size="sm" onClick={recording.onPlay} disabled={recording.playProgress !== null}>
                            <Play size={11} fill="currentColor" />
                            {recording.playProgress !== null ? "Playing…" : "Play Recording"}
                          </Button>
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

              <div className="flex items-center gap-2 border-t border-line-hair p-3">
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
                  className={cn(INPUT_SM_CLASS, "min-w-0")}
                />
                <Button size="md" className="w-[38px] px-0" aria-label="Send comment" title="Send comment" onClick={composer.onSubmit}>
                  <Send size={15} />
                </Button>
              </div>
            </>
          )}
        </aside>
  );
}

ReviewNotesPanel.displayName = "ReviewNotesPanel";
