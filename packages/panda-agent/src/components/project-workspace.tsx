import { useState } from "react";
import { Button } from "@field-ui/button";
import { INPUT_BASE_CLASS } from "@field-ui/input";
import { Spinner } from "@field-ui/spinner";
import type { AgentConnection, AgentStatus, ChannelOption } from "../api/agent";
import { agentApi } from "../api/agent";
import { useAgentMutation, useAgentSession, useAgentTools } from "../hooks/use-agent";
import { ConnectionPanel } from "./connection-panel";
import { Conversation } from "./conversation";
import { ErrorMessage, Notice } from "./notice";
import { ProposalCard } from "./proposal-card";
import { allowsProjectScope, hasCaptureScope } from "./capture-scope";

export function ProjectWorkspace({ projectId, status, channel, connection }: { projectId: string; status: AgentStatus; channel: ChannelOption; connection: AgentConnection | null }) {
  const query = useAgentSession(status.userId, channel, connection?.id ?? null, projectId, status.enabled);
  const tools = useAgentTools(status.userId, channel, connection?.id ?? null, projectId, status.enabled && (query.data?.capabilities?.capture === true || query.data?.capabilities?.read === true));
  const [unlinkedBuildingId, setUnlinkedBuildingId] = useState<string | null | undefined>();
  const changeBuilding = useAgentMutation((buildingId: string | null) => {
    if (!connection || (query.data?.capabilities?.capture !== true && query.data?.capabilities?.read !== true)) return Promise.resolve();
    return agentApi.setScope(projectId, connection.id, buildingId);
  });
  if (query.isPending) return <div className="grid min-h-60 place-items-center"><Spinner label="Loading authorized project" /></div>;
  if (query.isError || !query.data || query.data.projectId !== projectId || query.data.connectionId !== (connection?.id ?? null)) return <Notice title="Project access is unavailable" retry={() => void query.refetch()}>{query.error?.message ?? "Choose another project or refresh your access."}</Notice>;
  const chosenBuildingId = connection ? query.data.buildingId : unlinkedBuildingId === undefined ? query.data.buildingId : unlinkedBuildingId;
  const selectedBuildingId = query.data.buildings.some((building) => building.id === chosenBuildingId) ? chosenBuildingId : null;
  const session = { ...query.data, buildingId: selectedBuildingId };
  const canAccess = session.capabilities?.capture === true || session.capabilities?.read === true;
  if (!canAccess) return <Notice title="Site records are restricted">Your current project access does not allow capturing or viewing these site records.</Notice>;
  const drafts = session.proposals.filter((proposal) => proposal.status === "draft");
  const receipts = session.proposals.filter((proposal) => proposal.status !== "draft");
  const ready = hasCaptureScope(session, tools.data) && !changeBuilding.isPending;
  const scopeMatches = connection?.selectedScope?.projectId === projectId && connection.selectedScope.buildingId === session.buildingId;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className="space-y-5">
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold">Capture scope</h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">Choose the project for your site work. Diary entries and activity logs also need a building and work date.</p>
          {session.buildings.length > 0 ? <>
          <label className="mt-4 block text-sm font-medium" htmlFor="building">Building</label>
          <select id="building" className={`${INPUT_BASE_CLASS} mt-2 min-h-12 px-3`} value={session.buildingId ?? ""} disabled={changeBuilding.isPending || (session.capabilities?.capture !== true && session.capabilities?.read !== true)} onChange={(event) => {
            const selected = event.target.value || null;
            if (!selected && !allowsProjectScope(session, tools.data)) return;
            if (connection) changeBuilding.mutate(selected);
            else setUnlinkedBuildingId(selected);
          }}>
            <option value="">{allowsProjectScope(session, tools.data) ? "Project only" : "Choose building"}</option>
            {session.buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}
          </select>
          </> : <p className="mt-3 text-sm text-ink-muted">Project scope</p>}
          {session.buildings.length === 0 && session.capabilities?.capture === true && !allowsProjectScope(session, tools.data) ? <p className="mt-3 text-sm text-warning-600">No building is available for daily notes. Ask your project manager to check your building access.</p> : null}
          {connection && !scopeMatches && ready ? <Button className="mt-4" loading={changeBuilding.isPending} onClick={() => changeBuilding.mutate(session.buildingId)}>Use this project in {channel.label}</Button> : null}
          <ErrorMessage error={changeBuilding.error} />
        </section>
        <ConnectionPanel key={`${projectId}:${session.buildingId}`} channel={channel} connection={connection} session={session} catalog={tools.data} />
        <Button variant="ghost" onClick={() => { void query.refetch(); void tools.refetch(); }} disabled={query.isFetching || tools.isFetching}>Refresh conversation</Button>
      </aside>
      <main className="min-w-0 space-y-6">
        <Conversation key={`${projectId}:${session.buildingId}`} session={session} channelLabel={channel.label} enabled={ready && scopeMatches} uploads={tools.data?.uploads === true && !tools.isError} />
        <section aria-labelledby="review-heading" className="space-y-4">
          <div className="flex items-center justify-between gap-3"><h2 id="review-heading" className="text-lg font-semibold">Review before saving</h2><span className="text-sm text-ink-muted">{drafts.length} pending</span></div>
          <ErrorMessage error={tools.error} />
          {drafts.length > 0 ? drafts.map((proposal) => <ProposalCard key={`${proposal.id}:${proposal.version}`} proposal={proposal} session={session} enabled={ready && scopeMatches && !tools.isError} catalog={tools.isError ? undefined : tools.data} />) : <Notice title="All caught up">New site requests will appear here for review. You can correct details before saving.</Notice>}
        </section>
        {receipts.length > 0 ? <section aria-labelledby="receipts-heading" className="space-y-4">
          <h2 id="receipts-heading" className="text-lg font-semibold">Recent results</h2>
          {receipts.map((proposal) => <ProposalCard key={`${proposal.id}:${proposal.version}`} proposal={proposal} session={session} enabled={false} catalog={tools.isError ? undefined : tools.data} />)}
        </section> : null}
      </main>
    </div>
  );
}
