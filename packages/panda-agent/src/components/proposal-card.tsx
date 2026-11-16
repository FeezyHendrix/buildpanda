import { useState, type FormEvent } from "react";
import { htmlFromText, referencedFileIds } from "@buildpanda/rich-content";
import { Button } from "@field-ui/button";
import { Badge, type BadgeTone } from "@field-ui/badge";
import type { Proposal, ProposalAction, AgentSession } from "../api/agent";
import { agentApi } from "../api/agent";
import { useAgentMutation } from "../hooks/use-agent";
import { ActionFields } from "./action-fields";
import { ErrorMessage } from "./notice";

const statuses: Record<Proposal["status"], { label: string; tone: BadgeTone }> = {
  draft: { label: "Needs your review", tone: "warning" },
  confirmed: { label: "Saving", tone: "info" },
  completed: { label: "Saved", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  failed: { label: "Could not save", tone: "danger" },
};

const noteFields = new Set(["logDate", "buildingId", "bodyText", "bodyHtml"]);
const headerFields = new Set(["logDate", "buildingId", "summary", "summaryHtml", "weatherCondition", "workersExpected", "workersPresent", "totalHours", "temperatureC", "precipitationMm", "windKph"]);

function plainHtmlMatches(html: string, text: string): boolean {
  if ((html.match(/<[^>]*>/g) ?? []).some((tag) => !/^(?:<\/?p>|<br\s*\/?>)$/i.test(tag))) return false;
  const normalized = (value: string) => new DOMParser().parseFromString(value, "text/html").body.innerHTML;
  return normalized(html) === normalized(htmlFromText(text));
}

function supportedAction(action: ProposalAction): boolean {
  if (!["daily_log", "update_daily_log"].includes(action.kind) || referencedFileIds(action.payload).length) return false;
  const note = action.kind === "daily_log";
  const allowed = note ? noteFields : headerFields;
  if (Object.keys(action.payload).some((field) => !allowed.has(field))) return false;
  const html = action.payload[note ? "bodyHtml" : "summaryHtml"];
  const text = action.payload[note ? "bodyText" : "summary"];
  return typeof html !== "string" || plainHtmlMatches(html, typeof text === "string" ? text : "");
}

function reviewedActions(actions: ProposalAction[], original: ProposalAction[]): ProposalAction[] {
  return actions.map((action, index) => {
    const textKey = action.kind === "daily_log" ? "bodyText" : "summary";
    const htmlKey = action.kind === "daily_log" ? "bodyHtml" : "summaryHtml";
    const value = action.payload[textKey];
    const changed = value !== original[index]?.payload[textKey];
    return changed && typeof value === "string"
      ? { ...action, payload: { ...action.payload, [htmlKey]: htmlFromText(value) } }
      : action;
  });
}

export function ProposalCard({ proposal, session, enabled }: { proposal: Proposal; session: AgentSession; enabled: boolean }) {
  const [actions, setActions] = useState(proposal.actions);
  const [dirty, setDirty] = useState(false);
  const status = statuses[proposal.status] ?? { label: "Unavailable", tone: "neutral" };
  const canCreate = session.permissions.dailyLog?.includes("create") === true;
  const supported = proposal.actions.length > 0 && proposal.actions.every(supportedAction);
  const missing = actions.some((action) => (action.missing?.length ?? 0) > 0);
  const editable = enabled && canCreate && proposal.status === "draft" && supported;
  const edit = useAgentMutation(() => agentApi.edit(session.projectId, proposal, reviewedActions(actions, proposal.actions)));
  const confirm = useAgentMutation(() => agentApi.confirm(session.projectId, proposal));
  const cancel = useAgentMutation(() => agentApi.cancel(session.projectId, proposal));
  const busy = edit.isPending || confirm.isPending || cancel.isPending;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!editable || busy) return;
    if (dirty) edit.mutate(undefined);
    else if (!missing) confirm.mutate(undefined);
  }

  return (
    <article className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">{proposal.title}</h3>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-muted">{proposal.summary}</p>
      {proposal.status === "draft" && supported ? (
        <form onSubmit={submit} className="mt-5">
          <div className="space-y-6">
            {actions.map((action, index) => (
              <ActionFields key={`${index}:${action.kind}`} action={action} session={session} disabled={!editable || busy} onChange={(payload) => {
                setActions((current) => current.map((item, position) => position === index ? { ...item, payload } : item));
                setDirty(true);
              }} />
            ))}
          </div>
          {missing ? <p className="mt-4 text-sm text-warning-600">This draft has missing information. Complete the fields and save your corrections before confirming.</p> : null}
          {editable ? <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <Button type="submit" loading={edit.isPending || confirm.isPending} disabled={busy || (!dirty && missing)}>{dirty ? "Save corrections" : "Confirm and save"}</Button>
            <Button variant="ghost" onClick={() => cancel.mutate(undefined)} loading={cancel.isPending} disabled={busy}>Cancel draft</Button>
          </div> : null}
        </form>
      ) : null}
      {proposal.status === "draft" && !supported ? <p className="mt-4 text-sm text-warning-600">This draft contains fields, files or formatting that need the BuildPanda app. Continue there to review all details.</p> : null}
      {proposal.result?.message ? <p className="mt-4 rounded-lg bg-surface-alt p-3 text-sm" role="status">{proposal.result.message}</p> : null}
      <time className="mt-4 block text-xs text-ink-muted" dateTime={proposal.createdAt}>{new Date(proposal.createdAt).toLocaleString()}</time>
      <ErrorMessage error={edit.error ?? confirm.error ?? cancel.error} />
    </article>
  );
}
