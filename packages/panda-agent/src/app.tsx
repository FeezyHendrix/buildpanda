import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@field-ui/badge";
import { Button } from "@field-ui/button";
import { INPUT_BASE_CLASS } from "@field-ui/input";
import { Spinner } from "@field-ui/spinner";
import { ApiError } from "./api/client";
import { authApi } from "./api/auth";
import { agentKeys, useAgentStatus } from "./hooks/use-agent";
import { ErrorMessage, Notice } from "./components/notice";
import { ProjectWorkspace } from "./components/project-workspace";
import { SignInForm } from "./components/sign-in-form";
import { DocumentHandoff } from "./components/document-artifact";

const buildPandaUrl = (import.meta.env.VITE_BUILDPANDA_APP_URL || "http://localhost:5173").replace(/\/$/, "");
const channelKey = (channel: { id: string; accountId: string }) => `${channel.id}:${channel.accountId}`;

export default function App() {
  const status = useAgentStatus();
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null | undefined>();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  async function refreshAccount() {
    const previousUser = status.data?.userId;
    const result = await status.refetch();
    const protectedQueries = { queryKey: agentKeys.all, predicate: (query: { queryKey: readonly unknown[] }) => query.queryKey[1] !== "status" };
    if (result.isError || result.data?.userId !== previousUser) queryClient.removeQueries(protectedQueries);
    else await queryClient.invalidateQueries(protectedQueries);
  }
  const signOut = useMutation({
    mutationFn: authApi.signOut,
    onSuccess: async () => {
      queryClient.clear();
      setSelectedChannel(null); setSelectedConnectionId(undefined); setSelectedProjectId(null);
      await status.refetch();
    },
  });
  const channel = status.data?.channels.find((item) => channelKey(item) === selectedChannel)
    ?? status.data?.channels.find((item) => item.enabled);
  const connections = status.data?.connections.filter((item) => item.channel === channel?.id && item.accountId === channel.accountId) ?? [];
  const connection = selectedConnectionId === null ? null
    : connections.find((item) => item.id === selectedConnectionId) ?? connections[0] ?? null;
  const linkedProjectId = new URLSearchParams(window.location.search).get("projectId");
  const allowedProject = status.data?.projects.find((project) => project.id === (selectedProjectId ?? linkedProjectId ?? connection?.selectedScope?.projectId)) ?? status.data?.projects[0];
  const projectId = allowedProject?.id ?? "";
  const unauthorized = status.error instanceof ApiError && status.error.status === 401;

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-5 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div aria-hidden="true" className="grid size-11 place-items-center rounded-xl bg-primary-500 text-xl font-bold text-white">P</div>
            <div><p className="text-lg font-semibold">Panda Agent</p><p className="text-xs text-ink-muted">Your site work, connected</p></div>
          </div>
          <div className="flex items-center gap-4">
            <a href={buildPandaUrl} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary-600">Open BuildPanda <span aria-hidden="true" className="ml-2">↗</span></a>
            {status.isSuccess && status.data.userId ? <Button variant="secondary" aria-label="Sign out" loading={signOut.isPending} onClick={() => signOut.mutate()}>Sign out</Button> : null}
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <ErrorMessage error={signOut.error} />
        <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="mb-3 flex items-center gap-3"><span className="text-xs font-semibold uppercase tracking-widest text-ink-muted">Field capture</span>{status.isSuccess ? <Badge tone={connection ? "success" : "neutral"}>{connection ? `${channel?.label} connected` : "Connection required"}</Badge> : null}</div>
            <h1 className="text-3xl font-semibold tracking-tight">Keep the site record moving.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-ink-muted">Send an update by text or voice through a connected messaging app. Check the details, confirm the record, and keep its evidence together.</p>
          </div>
          {status.isSuccess && status.data.enabled ? <div className="flex w-full flex-wrap gap-4">
            <label className="block min-w-48 flex-1 text-sm font-medium" htmlFor="channel">Messaging app
              <select id="channel" aria-label="Messaging app" className={`${INPUT_BASE_CLASS} mt-2 min-h-12 px-3`} value={channel ? channelKey(channel) : ""} onChange={(event) => {
                setSelectedChannel(event.target.value); setSelectedConnectionId(undefined); setSelectedProjectId(null);
              }}>
                {!channel ? <option value="">No messaging app available</option> : null}
                {status.data.channels.map((item) => <option key={channelKey(item)} value={channelKey(item)} disabled={!item.enabled}>{item.label}{item.enabled ? "" : " (not configured)"}</option>)}
              </select>
            </label>
            <label className="block min-w-48 flex-1 text-sm font-medium" htmlFor="connection">Connection
              <select id="connection" aria-label="Connection" className={`${INPUT_BASE_CLASS} mt-2 min-h-12 px-3`} value={connection?.id ?? ""} onChange={(event) => { setSelectedConnectionId(event.target.value || null); setSelectedProjectId(null); }}>
                <option value="">New connection</option>
                {connections.map((item) => <option key={item.id} value={item.id}>{item.channelLabel} · {new Date(item.linkedAt).toLocaleString()}</option>)}
              </select>
            </label>
            {status.data.projects.length > 0 ? <label className="block min-w-48 flex-1 text-sm font-medium" htmlFor="project">Project
              <select id="project" aria-label="Project" className={`${INPUT_BASE_CLASS} mt-2 min-h-12 px-3`} value={projectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
                {status.data.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </label> : null}
          </div> : null}
        </div>
        {!signOut.isPending && status.isSuccess && status.data.userId ? <div className="mb-6"><DocumentHandoff userId={status.data.userId} projectIds={status.data.projects.map((project) => project.id)} /></div> : null}
        {signOut.isPending ? <div className="grid min-h-72 place-items-center"><Spinner label="Signing out" /></div> : status.isPending || unauthorized ? (
          <>
            <div hidden={status.isPending}><SignInForm buildPandaUrl={buildPandaUrl} onSignedIn={async () => {
              const result = await status.refetch();
              if (result.error) throw new Error("Your sign-in session could not be verified. Allow cookies for this site and try again, or open BuildPanda for account help.");
            }} /></div>
            {status.isPending ? <div className="grid min-h-72 place-items-center"><Spinner label="Checking your account" /></div> : null}
          </>
        ) : status.isError ? (
          <Notice title="We could not load your connections" retry={() => void status.refetch()}>{status.error.message}</Notice>
        ) : !status.data.userId ? (
          <Notice title="Your account could not be verified" retry={() => void status.refetch()}>Refresh your account before accessing site conversations.</Notice>
        ) : !status.data.enabled || !channel?.enabled ? (
          <Notice title="Messaging capture is not available yet">Your site records remain available in BuildPanda. A messaging app will become available here when its connection has been configured.</Notice>
        ) : !projectId ? (
          <Notice title="No available field projects">Your account does not currently have an accessible project for site capture or material logs. Ask your workspace administrator to check your project access.</Notice>
        ) : <ProjectWorkspace key={`${status.data.userId}:${channelKey(channel)}:${connection?.id ?? "new"}:${projectId}`} projectId={projectId} status={status.data} channel={channel} connection={connection} />}
        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-xs text-ink-muted"><p>Records follow your current BuildPanda project permissions.</p><Button variant="ghost" size="sm" disabled={status.isFetching} onClick={() => void refreshAccount()}>Refresh account</Button></footer>
      </div>
    </div>
  );
}
