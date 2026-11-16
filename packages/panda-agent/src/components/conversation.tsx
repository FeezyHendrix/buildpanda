import { useState, type FormEvent } from "react";
import { Button } from "@field-ui/button";
import { INPUT_BASE_CLASS } from "@field-ui/input";
import type { AgentSession } from "../api/agent";
import { agentApi } from "../api/agent";
import { useAgentMutation } from "../hooks/use-agent";
import { ErrorMessage } from "./notice";

const messageStatuses = { received: "Waiting for Panda", processing: "Preparing response", processed: "Handled", failed: "Could not process this message" };

export function Conversation({ session, enabled, channelLabel }: { session: AgentSession; enabled: boolean; channelLabel: string }) {
  const [text, setText] = useState("");
  const propose = useAgentMutation(async (value: string) => {
    await agentApi.propose(session.projectId, session.connectionId!, value);
    setText("");
  });
  const canCreate = session.permissions.dailyLog?.includes("create") === true;
  const canRead = session.permissions.dailyLog?.includes("view") === true;
  const retry = useAgentMutation((messageId: string) => agentApi.retryMessage(session.projectId, messageId));

  function submit(event: FormEvent) {
    event.preventDefault();
    if (enabled && canCreate && text.trim()) propose.mutate(text.trim());
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="border-b border-line p-5">
        <h2 className="font-semibold">Your site conversation</h2>
        <p className="mt-1 text-sm text-ink-muted">{channelLabel} text and voice requests use the same review and confirmation flow. Voice notes are translated to English for review.</p>
      </div>
      <div className="max-h-96 space-y-4 overflow-y-auto p-5" aria-label="Conversation messages" aria-live="polite">
        {canRead && session.messages.length > 0 ? session.messages.map((message) => (
          <article key={message.id} className={`max-w-xl rounded-xl p-4 ${message.role === "user" ? "ml-auto bg-primary-50" : "bg-surface-alt"}`}>
            <p className="text-xs font-semibold text-ink-muted">{message.role === "user" ? "You" : "Panda"}{message.inputType === "audio" ? " · Voice note" : ""}</p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{message.text}</p>
            <time className="mt-2 block text-xs text-ink-muted" dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time>
            {message.role === "user" && message.status ? <p className="mt-2 text-xs text-ink-muted" role="status">{messageStatuses[message.status]}</p> : null}
            {message.role === "user" && message.status === "failed" && message.retryable && canCreate && enabled ? <Button className="mt-3" size="sm" variant="secondary" loading={retry.isPending && retry.variables === message.id} disabled={retry.isPending} onClick={() => retry.mutate(message.id)}>Retry message</Button> : null}
          </article>
        )) : <p className="py-5 text-center text-sm text-ink-muted">{canRead ? "Your messages for this project will appear here." : "Conversation history requires daily-log viewing permission."}</p>}
      </div>
      <div className="px-5"><ErrorMessage error={retry.error} /></div>
      {canCreate ? (
        <form onSubmit={submit} className="border-t border-line p-5">
          <label className="mb-2 block text-sm font-medium" htmlFor="site-message">Describe the site update</label>
          <textarea id="site-message" className={`${INPUT_BASE_CLASS} min-h-28 resize-y p-4`} value={text} onChange={(event) => setText(event.target.value)} maxLength={10_000} disabled={!enabled || propose.isPending} placeholder="For Block B yesterday, eight workers were on site. We poured twelve cubic metres of concrete…" />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-sm text-xs leading-5 text-ink-muted">{enabled ? "Send voice notes to Panda through your connected messaging app. Nothing is saved as a site record until you confirm its review." : "Connect a messaging app and choose a building to prepare a review."}</p>
            <Button type="submit" disabled={!enabled || !text.trim()} loading={propose.isPending}>Prepare review</Button>
          </div>
          <ErrorMessage error={propose.error} />
        </form>
      ) : null}
    </section>
  );
}
