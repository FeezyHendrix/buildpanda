import { useEffect, useRef, useState, type ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { RichTextField } from "@/components/molecules/rich-text-field";
import {
  useAddDailyLogEntry,
  useDownloadDailyReport,
  useEmailDailyReport,
  useProjectDailyLog,
} from "@/hooks/use-daily-logs";
import type { DailyLogDay } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { DailyLogEntryRow } from "./daily-log-entry-row";
import { formatDayDate, formatHours, formatWeekday, WEATHER_LABEL, WEATHER_TONE } from "./daily-log-helpers";

interface DailyLogDrawerProps {
  open: boolean;
  projectId: string;
  logDate: string | null;
  /** Scroll to and focus the entry composer once the day has loaded. */
  focusComposer: boolean;
  userId: string | null;
  canCreateEntry: boolean;
  canVoidEntry: boolean;
  canGenerateReport: boolean;
  onOpenChange: (open: boolean) => void;
  onEditConditions: (logDate: string) => void;
}

function DailyLogDrawer({
  open,
  projectId,
  logDate,
  focusComposer,
  userId,
  canCreateEntry,
  canVoidEntry,
  canGenerateReport,
  onOpenChange,
  onEditConditions,
}: DailyLogDrawerProps) {
  const dayQuery = useProjectDailyLog(open && logDate ? projectId : undefined, logDate ?? undefined);
  const day = dayQuery.data;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/30 backdrop-blur-sm transition-opacity duration-300",
            "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
          )}
        />
        <Dialog.Popup
          // When the composer is requested, the dialog's own initial focus would
          // land on the close button and beat the editor; the composer focuses itself.
          initialFocus={focusComposer ? false : true}
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-xl outline-none md:w-[min(750px,100vw)]",
            "transition-transform duration-300 ease-out",
            "data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full",
          )}
        >
          <header className="flex items-start justify-between gap-4 border-b border-[#F0F0F0] px-6 py-5">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                Daily log · {logDate ? formatDayDate(logDate) : ""}
              </Dialog.Title>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                {logDate ? <span>{formatWeekday(logDate)}</span> : null}
                {day?.voidedAt ? <Badge tone="danger" size="sm">Voided</Badge> : null}
              </div>
            </div>
            <Dialog.Close
              aria-label="Close"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-gray-500 outline-none hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900/10"
            >
              <X className="size-5" />
            </Dialog.Close>
          </header>

          {!day || !logDate ? (
            <div className="flex flex-1 items-center justify-center">
              {dayQuery.isError ? (
                <p className="text-sm text-red-600">Could not load this day.</p>
              ) : (
                <Spinner size="md" />
              )}
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-8 overflow-y-auto px-6 py-5">
              <ConditionsSection day={day} canEdit={canCreateEntry} onEdit={() => onEditConditions(logDate)} />
              <ActivitiesSection day={day} />
              <EntriesSection
                day={day}
                projectId={projectId}
                userId={userId}
                canCreateEntry={canCreateEntry}
                canVoidEntry={canVoidEntry}
                focusComposer={focusComposer}
              />
              {canGenerateReport ? <ReportSection projectId={projectId} logDate={logDate} /> : null}
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

DailyLogDrawer.displayName = "DailyLogDrawer";

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{title}</h4>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function EditLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-[13px] font-medium text-primary hover:underline">
      {label}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-[#EDEDED] bg-white p-3">
      <p className="text-[11px] font-medium text-gray-500">{label}</p>
      <div className="mt-1 text-lg font-semibold tabular-nums text-gray-900">{value}</div>
    </div>
  );
}

function ConditionsSection({ day, canEdit, onEdit }: { day: DailyLogDay; canEdit: boolean; onEdit: () => void }) {
  const hasConditions = day.weatherCondition !== null || day.workersExpected > 0 || day.workersPresent > 0 || day.totalHours > 0;
  return (
    <Section title="Conditions" action={canEdit ? <EditLink label={hasConditions ? "Edit" : "Add conditions"} onClick={onEdit} /> : null}>
      {hasConditions ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric
            label="Weather"
            value={
              day.weatherCondition ? (
                <Badge tone={WEATHER_TONE[day.weatherCondition]} size="md">{WEATHER_LABEL[day.weatherCondition]}</Badge>
              ) : (
                "—"
              )
            }
          />
          <Metric label="Temperature" value={day.temperatureC !== null ? `${day.temperatureC}°C` : "—"} />
          <Metric label="Crew present" value={`${day.workersPresent}/${day.workersExpected}`} />
          <Metric label="Total hours" value={formatHours(day.totalHours)} />
        </div>
      ) : (
        <p className="rounded-xl bg-[#F8F8F8] p-4 text-sm text-gray-500">No site conditions recorded for this day.</p>
      )}
    </Section>
  );
}

function ActivitiesSection({ day }: { day: DailyLogDay }) {
  const total = day.activities.reduce((sum, a) => sum + a.hoursLogged, 0);
  return (
    <Section title="Activities">
      {day.activities.length === 0 ? (
        <p className="rounded-xl bg-[#F8F8F8] p-4 text-sm text-gray-500">No activities logged against this day.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#EDEDED]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#EDEDED] bg-[#FAFAFA]">
              <tr>
                <th className="px-4 py-2.5 text-[11px] font-semibold capitalize text-black-300">Activity</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold capitalize text-black-300">Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F0]">
              {day.activities.map((a) => (
                <tr key={a.activityId}>
                  <td className="px-4 py-2.5 text-gray-900">{a.activityName}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-900">{formatHours(a.hoursLogged)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-[#EDEDED] bg-[#FAFAFA]">
              <tr>
                <td className="px-4 py-2.5 font-semibold text-gray-900">Total</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900">{formatHours(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Section>
  );
}

interface EntriesProps {
  day: DailyLogDay;
  projectId: string;
  userId: string | null;
  canCreateEntry: boolean;
  canVoidEntry: boolean;
  focusComposer: boolean;
}

function EntriesSection({ day, projectId, userId, canCreateEntry, canVoidEntry, focusComposer }: EntriesProps) {
  return (
    <Section title={`Entries (${day.entries.length})`}>
      {day.entries.length === 0 ? (
        <p className="rounded-xl bg-[#F8F8F8] p-4 text-sm text-gray-500">No team logs for this day yet.</p>
      ) : (
        <div className="flex flex-col divide-y divide-[#EDEDED]">
          {day.entries.map((entry) => (
            <DailyLogEntryRow
              key={entry.id}
              projectId={projectId}
              logDate={day.logDate}
              entry={entry}
              userId={userId}
              canVoidEntry={canVoidEntry}
            />
          ))}
        </div>
      )}
      {canCreateEntry ? <EntryComposer projectId={projectId} logDate={day.logDate} autoFocus={focusComposer} /> : null}
    </Section>
  );
}

function EntryComposer({ projectId, logDate, autoFocus }: { projectId: string; logDate: string; autoFocus: boolean }) {
  const [html, setHtml] = useState("");
  const [text, setText] = useState("");
  const [editorKey, setEditorKey] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const addEntry = useAddDailyLogEntry();

  // The tiptap editor mounts a tick after the drawer, so watch the wrapper and
  // focus the contenteditable as soon as it exists (no rAF: it never fires in a
  // background tab). The popup's own initial focus is disabled in that mode.
  useEffect(() => {
    if (!autoFocus) return;
    const root = wrapperRef.current;
    if (!root) return;
    const focusEditor = (): boolean => {
      const target = root.querySelector<HTMLElement>('[contenteditable="true"]');
      if (!target) return false;
      target.scrollIntoView({ block: "center" });
      target.focus();
      return true;
    };
    if (focusEditor()) return;
    const observer = new MutationObserver(() => {
      if (focusEditor()) observer.disconnect();
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [autoFocus, logDate]);

  const hasContent = text.trim().length > 0;

  function submit(): void {
    addEntry.mutate(
      { projectId, logDate, bodyHtml: html, bodyText: text },
      {
        onSuccess: () => {
          setHtml("");
          setText("");
          setEditorKey((k) => k + 1);
          toast("Your log was added", "success");
        },
        onError: () => toast("Could not add your log"),
      },
    );
  }

  return (
    <div ref={wrapperRef} className="mt-4 flex flex-col gap-3 border-t border-[#EDEDED] pt-4">
      <RichTextField
        key={editorKey}
        label="Add my log"
        value={html}
        onChange={setHtml}
        onChangeText={setText}
        projectId={projectId}
        placeholder="e.g. Completed the level 3 slab pour, inspected rebar, flagged a delivery delay…"
      />
      {addEntry.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{(addEntry.error as Error).message}</p>
      ) : null}
      <div className="flex justify-end">
        <Button type="button" variant="primary" size="sm" disabled={!hasContent} loading={addEntry.isPending} onClick={submit}>
          Add entry
        </Button>
      </div>
    </div>
  );
}

function ReportSection({ projectId, logDate }: { projectId: string; logDate: string }) {
  const download = useDownloadDailyReport();
  const email = useEmailDailyReport();
  return (
    <Section title="Report">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={download.isPending}
          onClick={() => download.mutate({ projectId, logDate }, { onError: () => toast("Could not download report") })}
        >
          Download report
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={email.isPending}
          onClick={() =>
            email.mutate(
              { projectId, logDate },
              {
                onSuccess: (res) => toast(`Report sent to ${res.sentTo}`, "success"),
                onError: () => toast("Could not email report"),
              },
            )
          }
        >
          Email me
        </Button>
      </div>
    </Section>
  );
}

export { DailyLogDrawer, type DailyLogDrawerProps };
