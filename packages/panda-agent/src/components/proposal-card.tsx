import { useState, type FormEvent } from "react";
import { Button } from "@field-ui/button";
import { Badge, type BadgeTone } from "@field-ui/badge";
import type { Proposal, ProposalAction, AgentSession } from "../api/agent";
import type { ToolCatalog } from "../api/tool-types";
import { agentApi } from "../api/agent";
import { useAgentMutation } from "../hooks/use-agent";
import { GenericReviewFields } from "./review-fields";
import { allowedAction, knownAction, reviewActionIssues, reviewTool } from "./review-schema";
import { ErrorMessage } from "./notice";
import { ProposalDocuments } from "./document-artifact";

const statuses: Record<Proposal["status"], { label: string; tone: BadgeTone }> = {
  draft: { label: "Needs your review", tone: "warning" },
  confirmed: { label: "Working", tone: "info" },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  failed: { label: "Could not complete", tone: "danger" },
};

export function ProposalCard({ proposal, session, enabled, catalog }: { proposal: Proposal; session: AgentSession; enabled: boolean; catalog?: ToolCatalog }) {
  const [actions, setActions] = useState(proposal.actions);
  const [dirty, setDirty] = useState(false);
  const [uploads, setUploads] = useState(0);
  const status = statuses[proposal.status] ?? { label: "Unavailable", tone: "neutral" };
  const tools = actions.map((action) => reviewTool(action, catalog));
  const supported = actions.length > 0 && tools.every(Boolean);
  const missing = actions.some((action) => (action.missing?.length ?? 0) > 0);
  const allowed = actions.every((action) => allowedAction(action, session));
  const issues = actions.flatMap((action, index) => tools[index] && catalog ? reviewActionIssues(tools[index]!, action.payload, catalog) : ["Refresh the available action fields before saving."]);
  const valid = supported && issues.length === 0;
  const editable = enabled && actions.every((action) => knownAction(action, session)) && proposal.capabilities?.edit === true && proposal.status === "draft" && supported;
  const confirmable = enabled && allowed && valid && !missing && !proposal.clarification && proposal.status === "draft" && proposal.capabilities?.confirm === true;
  const cancellable = enabled && (session.capabilities?.capture === true || session.capabilities?.read === true) && proposal.capabilities?.cancel === true && proposal.status === "draft";
  const edit = useAgentMutation((reviewed: ProposalAction[]) => {
    if (!editable || !valid || !reviewed.every((action) => allowedAction(action, session)) || uploads > 0) throw new Error("Complete the required fields for an action you can perform.");
    return agentApi.edit(session.projectId, proposal, reviewed);
  });
  const confirm = useAgentMutation(() => {
    if (!confirmable || dirty || uploads > 0) throw new Error("Refresh and review the permitted action before confirming.");
    return agentApi.confirm(session.projectId, proposal);
  });
  const cancel = useAgentMutation(() => {
    if (!cancellable) throw new Error("You cannot cancel this review.");
    return agentApi.cancel(session.projectId, proposal);
  });
  const busy = edit.isPending || confirm.isPending || cancel.isPending || uploads > 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (dirty && editable) edit.mutate(actions);
    else if (confirmable) confirm.mutate(undefined);
  }

  return (
    <article className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">{proposal.title}</h3>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-muted">{proposal.summary}</p>
      {proposal.status === "draft" && proposal.clarification ? <p role="status" className="mt-4 whitespace-pre-wrap rounded-lg bg-primary-50 p-4 text-sm leading-6">{proposal.clarification}</p> : null}
      {proposal.status === "draft" && supported ? (
        <form onSubmit={submit} className="mt-5">
          <div className="space-y-6">
            {actions.map((action, index) => (
              <fieldset key={`${index}:${action.kind}`} className="space-y-4"><legend className="mb-3 font-semibold">{action.title}</legend><GenericReviewFields schema={tools[index]!.schema} payload={action.payload}
                context={{ projectId: session.projectId, descriptor: tools[index]!, catalog: catalog!, disabled: !editable || busy, onPending: (delta) => setUploads((count) => Math.max(0, count + delta)) }} onChange={(payload) => {
                setActions((current) => current.map((item, position) => position === index ? { ...item, payload } : item));
                setDirty(true);
              }} /></fieldset>
            ))}
          </div>
          {missing ? <p className="mt-4 text-sm text-warning-600">This draft has missing information. Complete the fields and save your corrections before confirming.</p> : null}
          {!valid ? <p className="mt-4 text-sm text-warning-600">Complete the required fields before saving or confirming.</p> : null}
          {issues.length ? <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-warning-600">{issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul> : null}
          {editable && !allowed ? <p className="mt-4 text-sm text-warning-600">Your current access does not allow this action or movement.</p> : null}
          {editable || confirmable || cancellable ? <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            {(editable && dirty) || proposal.capabilities?.confirm === true ? <Button type="submit" aria-label={dirty ? "Save corrections" : "Confirm"} loading={edit.isPending || confirm.isPending} disabled={busy || !allowed || !valid || (dirty ? !editable : !confirmable)}>{dirty ? "Save corrections" : "Confirm"}</Button> : null}
            {cancellable ? <Button type="button" aria-label="Cancel draft" variant="ghost" onClick={() => cancel.mutate(undefined)} loading={cancel.isPending} disabled={busy}>Cancel draft</Button> : null}
          </div> : null}
        </form>
      ) : null}
      {proposal.status === "draft" && !supported && !proposal.clarification ? <p className="mt-4 text-sm text-warning-600">This draft has unavailable action fields. Refresh the conversation to load the authorized tools before saving.</p> : null}
      {proposal.status === "draft" && !supported && cancellable ? <Button type="button" aria-label="Cancel draft" variant="ghost" className="mt-4" onClick={() => cancel.mutate(undefined)} loading={cancel.isPending} disabled={busy}>Cancel draft</Button> : null}
      {proposal.result?.message ? <p className="mt-4 rounded-lg bg-surface-alt p-3 text-sm" role="status">{proposal.result.message}</p> : null}
      {proposal.artifacts?.length ? <ProposalDocuments artifacts={proposal.artifacts} catalog={catalog} available={session.capabilities?.actions?.open_document === true || session.capabilities?.actions?.download_document === true} /> : null}
      <time className="mt-4 block text-xs text-ink-muted" dateTime={proposal.createdAt}>{new Date(proposal.createdAt).toLocaleString()}</time>
      <ErrorMessage error={edit.error ?? confirm.error ?? cancel.error} />
    </article>
  );
}
