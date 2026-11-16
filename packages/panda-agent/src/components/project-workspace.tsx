import { useState } from "react";
import { Button } from "@field-ui/button";
import { INPUT_BASE_CLASS } from "@field-ui/input";
import { Spinner } from "@field-ui/spinner";
import type { AgentConnection, AgentStatus, ChannelOption } from "../api/agent";
import { agentApi } from "../api/agent";
import { useAgentMutation, useAgentSession } from "../hooks/use-agent";
import { ConnectionPanel } from "./connection-panel";
import { Conversation } from "./conversation";
import { ErrorMessage, Notice } from "./notice";
import { ProposalCard } from "./proposal-card";

export function ProjectWorkspace({ projectId, status, channel, connection }: { projectId: string; status: AgentStatus; channel: ChannelOption; connection: AgentConnection | null }) {
  const query = useAgentSession(status.userId, channel, connection?.id ?? null, projectId, status.enabled);
  const [unlinkedBuildingId, setUnlinkedBuildingId] = useState<string | null>(null);
  const changeBuilding = useAgentMutation((buildingId: string) => agentApi.setScope(projectId, connection!.id, buildingId));
  if (query.isPending) return <div className="grid min-h-60 place-items-center"><Spinner label="Loading authorized project" /></div>;
  if (query.isError || !query.data || query.data.projectId !== projectId || query.data.connectionId !== (connection?.id ?? null)) return <Notice title="Project access is unavailable" retry={() => void query.refetch()}>{query.error?.message ?? "Choose another project or refresh your access."}</Notice>;
  const chosenBuildingId = connection ? query.data.buildingId : unlinkedBuildingId ?? query.data.buildingId;
  const selectedBuildingId = query.data.buildings.some((building) => building.id === chosenBuildingId) ? chosenBuildingId : null;
  const session = { ...query.data, buildingId: selectedBuildingId };
  const canAccess = session.permissions.dailyLog?.some((action) => ["view", "create"].includes(action)) === true;
  if (!canAccess) return <Notice title="Daily logs are restricted">Your current project permissions do not allow site capture or viewing daily logs.</Notice>;
  const drafts = session.proposals.filter((proposal) => proposal.status === "draft");
  const receipts = session.proposals.filter((proposal) => proposal.status !== "draft");
  const ready = Boolean(session.buildingId) && !changeBuilding.isPending;
  const scopeMatches = connection?.selectedScope?.projectId === projectId && connection.selectedScope.buildingId === session.buildingId;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className="space-y-5">
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold">Capture scope</h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">Every draft stays with its original project, building and work date.</p>
          <label className="mt-4 block text-sm font-medium" htmlFor="building">Building</label>
          <select id="building" className={`${INPUT_BASE_CLASS} mt-2 min-h-12 px-3`} value={session.buildingId ?? ""} disabled={changeBuilding.isPending} onChange={(event) => {
            if (!event.target.value) return;
            if (connection) changeBuilding.mutate(event.target.value);
            else setUnlinkedBuildingId(event.target.value);
          }}>
            <option value="">Choose building</option>
            {session.buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}
          </select>
          {session.buildings.length === 0 ? <p className="mt-3 text-sm text-warning-600">This project has no available buildings. Ask your project manager to add one.</p> : null}
          {connection && !scopeMatches && ready ? <Button className="mt-4" loading={changeBuilding.isPending} onClick={() => changeBuilding.mutate(session.buildingId!)}>Use this project in {channel.label}</Button> : null}
          <ErrorMessage error={changeBuilding.error} />
        </section>
        <ConnectionPanel key={`${projectId}:${session.buildingId}`} channel={channel} connection={connection} session={session} />
        <Button variant="ghost" onClick={() => void query.refetch()} disabled={query.isFetching}>Refresh conversation</Button>
      </aside>
      <main className="min-w-0 space-y-6">
        <Conversation key={`${projectId}:${session.buildingId}`} session={session} channelLabel={channel.label} enabled={ready && scopeMatches} />
        <section aria-labelledby="review-heading" className="space-y-4">
          <div className="flex items-center justify-between gap-3"><h2 id="review-heading" className="text-lg font-semibold">Review before saving</h2><span className="text-sm text-ink-muted">{drafts.length} pending</span></div>
          {drafts.length > 0 ? drafts.map((proposal) => <ProposalCard key={`${proposal.id}:${proposal.version}`} proposal={proposal} session={session} enabled={ready && scopeMatches} />) : <Notice title="All caught up">New site requests will appear here for review. You can correct details before saving.</Notice>}
        </section>
        {receipts.length > 0 ? <section aria-labelledby="receipts-heading" className="space-y-4">
          <h2 id="receipts-heading" className="text-lg font-semibold">Recent results</h2>
          {receipts.map((proposal) => <ProposalCard key={`${proposal.id}:${proposal.version}`} proposal={proposal} session={session} enabled={false} />)}
        </section> : null}
      </main>
    </div>
  );
}
