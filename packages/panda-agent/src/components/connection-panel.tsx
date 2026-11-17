import { useState } from "react";
import { Button } from "@field-ui/button";
import { Badge } from "@field-ui/badge";
import type { AgentConnection, AgentSession, ChannelOption, LinkCode } from "../api/agent";
import type { ToolCatalog } from "../api/tool-types";
import { agentApi } from "../api/agent";
import { useAgentMutation } from "../hooks/use-agent";
import { ErrorMessage } from "./notice";
import { hasCaptureScope } from "./capture-scope";

function safeConnectUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function ConnectionPanel({ channel, connection, session, catalog }: { channel: ChannelOption; connection: AgentConnection | null; session: AgentSession; catalog?: ToolCatalog }) {
  const [link, setLink] = useState<LinkCode | null>(null);
  const connect = useAgentMutation(async () => {
    if (!channel.enabled || (!session.capabilities?.capture && !session.capabilities?.read) || !hasCaptureScope(session, catalog)) return;
    setLink(await agentApi.link(channel, { projectId: session.projectId, buildingId: session.buildingId }));
  });
  const unlink = useAgentMutation(async () => {
    if (!connection) return;
    await agentApi.unlink(connection.id);
    setLink(null);
  });
  const canCreate = session.capabilities?.capture === true || session.capabilities?.read === true;
  const ready = channel.enabled && hasCaptureScope(session, catalog) && canCreate;
  const expired = Boolean(link && new Date(link.expiresAt).getTime() <= Date.now());
  const connectUrl = safeConnectUrl(link?.connectUrl ?? null);

  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">{channel.label} connection</h2>
        <Badge tone={connection ? "success" : "neutral"}>{connection ? "Connected" : "Not connected"}</Badge>
      </div>
      <p className="mt-3 text-sm leading-6 text-ink-muted">Send text, voice notes and follow-up corrections to Panda through {channel.label}. Review records here or in that conversation.</p>
      {connection ? (
        <Button variant="secondary" className="mt-4" loading={unlink.isPending} onClick={() => {
          if (window.confirm(`Disconnect this ${channel.label} connection? Pending confirmations will require a new connection.`)) unlink.mutate(undefined);
        }}>Disconnect account</Button>
      ) : (
        <>
          <Button className="mt-4" loading={connect.isPending} disabled={!ready} onClick={() => connect.mutate(undefined)}>
            {link ? "Get a new connection code" : `Connect ${channel.label}`}
          </Button>
          {!canCreate ? <p className="mt-3 text-sm text-ink-muted">Site capture permission is required to connect this project.</p> : null}
          {link ? (
            <div className="mt-4 rounded-xl bg-primary-50 p-4" aria-live="polite">
              <p className="text-sm font-medium">Send this command to Panda in {channel.label}</p>
              <p className="my-3 break-all font-mono text-xl tracking-wide">LINK {link.code}</p>
              <p className="text-xs text-ink-muted">{expired ? "This code has expired. Generate a new one." : `Expires ${new Date(link.expiresAt).toLocaleTimeString()}.`}</p>
              {!expired && connectUrl ? <a className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary-600 underline" href={connectUrl} target="_blank" rel="noreferrer">Open {channel.label}</a> : null}
            </div>
          ) : null}
        </>
      )}
      <ErrorMessage error={connect.error ?? unlink.error} />
    </section>
  );
}
