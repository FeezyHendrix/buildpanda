import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/atoms/button";
import { Input, INPUT_SM_CLASS } from "@/components/atoms/input";
import { type Estimate, type PaymentScheduleItem, type ScheduleKind } from "@/api/proposals";
import { usePreconProgramme, usePreconSessions } from "@/hooks/use-precon";
import { useReplacePaymentSchedule } from "@/hooks/use-proposals";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatWholeCurrency as fmt } from "@/lib/formatters";
import { toast } from "@/lib/toast";
import { Badge } from "@/components/atoms/badge";

interface StageDraft {
  key: string;
  label: string;
  percent: string;
  kind: ScheduleKind;
  programmeTaskId: string | null;
}

interface Props {
  proposalId: string;
  estimate: Estimate;
  currency: string;
  isDraft: boolean;
  canEdit: boolean;
}

const LAGOS_DEFAULT: Omit<StageDraft, "key">[] = [
  { label: "Advance on signing", percent: "20", kind: "advance", programmeTaskId: null },
  { label: "Foundation and DPC complete", percent: "25", kind: "stage", programmeTaskId: null },
  { label: "Roof on", percent: "25", kind: "stage", programmeTaskId: null },
  { label: "Finishes complete", percent: "20", kind: "stage", programmeTaskId: null },
  { label: "Handover", percent: "10", kind: "stage", programmeTaskId: null },
];

let keySeq = 0;
const withKey = (s: Omit<StageDraft, "key">): StageDraft => ({ ...s, key: `st${++keySeq}` });

function fromEstimate(schedule: PaymentScheduleItem[]): StageDraft[] {
  return schedule.map((s) => withKey({ label: s.label, percent: String(s.percent), kind: s.kind, programmeTaskId: s.programmeTaskId }));
}

function sumPercent(stages: StageDraft[]): number {
  return Math.round(stages.reduce((sum, s) => sum + (parseFloat(s.percent) || 0), 0) * 100) / 100;
}

// Percent milestones the client pays against. Each stage may bind to a
// programme milestone so its week is a forecast, and the whole thing must make
// exactly 100 before the revision can be sent.
export function PaymentSchedulePanel({ proposalId, estimate, currency, isDraft, canEdit }: Props) {
  const replace = useReplacePaymentSchedule(proposalId);
  const [stages, setStages] = useState<StageDraft[]>(() => fromEstimate(estimate.schedule));
  useEffect(() => setStages(fromEstimate(estimate.schedule)), [estimate.id, estimate.schedule]);

  // milestones from the proposal's most recent measured take-off, when one exists
  const { data: sessions = [] } = usePreconSessions(proposalId);
  const measured = sessions.find((s) => s.status === "reviewing" || s.status === "output") ?? null;
  const { data: programme } = usePreconProgramme(measured?.id ?? "");
  const milestones = useMemo(() => (programme?.tasks ?? []).filter((t) => t.isMilestone && t.status !== "rejected"), [programme]);

  const editable = isDraft && canEdit;
  const total = sumPercent(stages);
  const complete = Math.abs(total - 100) < 0.01;
  const advances = stages.filter((s) => s.kind === "advance").length;

  const update = (key: string, patch: Partial<StageDraft>) =>
    setStages((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const remove = (key: string) => setStages((prev) => prev.filter((s) => s.key !== key));
  const add = () => setStages((prev) => [...prev, withKey({ label: "", percent: "0", kind: "stage", programmeTaskId: null })]);
  const move = (key: string, dir: -1 | 1) =>
    setStages((prev) => {
      const i = prev.findIndex((s) => s.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  const save = () =>
    replace.mutate(
      {
        estimateId: estimate.id,
        items: stages.map((s, i) => ({
          label: s.label.trim(),
          percent: parseFloat(s.percent) || 0,
          kind: s.kind,
          programmeTaskId: s.programmeTaskId,
          sort: i,
        })),
      },
      {
        onSuccess: () => toast("Payment stages saved.", "success"),
        onError: (err) => toast(getApiErrorMessage(err, "Could not save the payment stages."), "error"),
      },
    );

  return (
    <div className="rounded-lg border border-line bg-white p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-medium uppercase text-ink-muted">Payment stages</h3>
          <p className="mt-1 text-sm text-gray-500">Percent of the total due at each stage. Must total 100 before sending.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={complete ? "success" : "warning"} dot>
            {total} %{complete ? "" : ` · ${Math.round((100 - total) * 100) / 100} % to allocate`}
          </Badge>
          {editable && stages.length === 0 ? (
            <Button size="sm" variant="secondary" onClick={() => setStages(LAGOS_DEFAULT.map(withKey))}>
              Use the standard stages
            </Button>
          ) : null}
          {editable ? (
            <Button size="sm" loading={replace.isPending} disabled={!complete || advances > 1} onClick={save}>
              Save stages
            </Button>
          ) : null}
        </div>
      </div>

      {stages.length === 0 ? (
        <p className="rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          No payment stages yet. {editable ? "Start from the standard Lagos residential set or add stages by hand." : ""}
        </p>
      ) : (
        <ul className="divide-y divide-line-hair">
          {stages.map((stage, index) => {
            const amount = (estimate.total * (parseFloat(stage.percent) || 0)) / 100;
            return (
              <li key={stage.key} className="grid grid-cols-[1fr_auto] items-center gap-3 py-2 md:grid-cols-[minmax(0,2fr)_110px_minmax(0,1.4fr)_110px_auto]">
                <div className="flex items-center gap-2">
                  <select
                    aria-label="Stage kind"
                    className={INPUT_SM_CLASS}
                    value={stage.kind}
                    disabled={!editable}
                    onChange={(e) => update(stage.key, { kind: e.target.value as ScheduleKind })}
                  >
                    <option value="stage">Stage</option>
                    <option value="advance">Advance</option>
                  </select>
                  <Input value={stage.label} placeholder="Roof on" disabled={!editable} onChange={(e) => update(stage.key, { label: e.target.value })} />
                </div>
                <Input type="number" min="0" max="100" step="0.5" value={stage.percent} disabled={!editable} onChange={(e) => update(stage.key, { percent: e.target.value })} className="text-right" aria-label="Percent" />
                <select
                  aria-label="Bind to programme milestone"
                  className={INPUT_SM_CLASS}
                  value={stage.programmeTaskId ?? ""}
                  disabled={!editable || milestones.length === 0}
                  onChange={(e) => update(stage.key, { programmeTaskId: e.target.value || null })}
                >
                  <option value="">{milestones.length === 0 ? "No programme milestones yet" : "Not bound to a milestone"}</option>
                  {milestones.map((m) => (
                    <option key={m.id} value={m.id}>
                      ◆ {m.name}
                    </option>
                  ))}
                </select>
                <span className="text-right text-sm tabular-nums text-gray-800">{fmt(amount, currency)}</span>
                <div className="flex items-center gap-0.5">
                  {editable ? (
                    <>
                      <button type="button" className="rounded px-1.5 py-1 text-xs text-gray-400 hover:bg-gray-100 disabled:opacity-30" disabled={index === 0} onClick={() => move(stage.key, -1)} aria-label="Move up">↑</button>
                      <button type="button" className="rounded px-1.5 py-1 text-xs text-gray-400 hover:bg-gray-100 disabled:opacity-30" disabled={index === stages.length - 1} onClick={() => move(stage.key, 1)} aria-label="Move down">↓</button>
                      <button type="button" className="rounded px-1.5 py-1 text-xs text-red-500 hover:bg-red-50" onClick={() => remove(stage.key)}>Remove</button>
                    </>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {advances > 1 ? <p className="mt-2 text-xs text-red-600">Only one advance stage is allowed.</p> : null}
      {editable ? (
        <Button size="sm" variant="secondary" className="mt-3" onClick={add}>
          + Add stage
        </Button>
      ) : null}
    </div>
  );
}
PaymentSchedulePanel.displayName = "PaymentSchedulePanel";
