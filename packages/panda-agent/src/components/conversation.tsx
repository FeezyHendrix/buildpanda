import { useState, type FormEvent } from "react";
import { Button } from "@field-ui/button";
import { INPUT_BASE_CLASS, Input } from "@field-ui/input";
import type { AgentSession } from "../api/agent";
import { agentApi } from "../api/agent";
import { useAgentMutation } from "../hooks/use-agent";
import { ErrorMessage } from "./notice";

const messageStatuses = { received: "Waiting for Panda", processing: "Preparing response", processed: "Handled", failed: "Could not process this message" };

export function Conversation({ session, enabled, channelLabel, uploads = false }: { session: AgentSession; enabled: boolean; channelLabel: string; uploads?: boolean }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const canAsk = session.capabilities?.capture === true || session.capabilities?.read === true;
  const propose = useAgentMutation(async (value: string) => {
    if (!enabled || !canAsk || !session.connectionId) return;
    await agentApi.propose(session.projectId, session.connectionId, value);
    setText("");
  });
  const canCreate = session.capabilities?.capture === true;
  const canRead = session.capabilities?.read === true;
  const retry = useAgentMutation((messageId: string) => {
    if (!enabled || !canAsk || !session.messages.some((message) => message.id === messageId && message.status === "failed" && message.retryable)) return Promise.resolve();
    return agentApi.retryMessage(session.projectId, messageId);
  });
  const upload = useAgentMutation(async (value: { file: File; text: string }) => {
    if (!enabled || !canCreate || !uploads || !session.connectionId) return;
    await agentApi.uploadMessage(session.projectId, session.connectionId, value.file, value.text);
    setFile(null); setText("");
  });
  const pending = propose.isPending || upload.isPending;
  const blockedFile = Boolean(file && (!canCreate || !uploads));

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!enabled || !canAsk || pending || blockedFile) return;
    if (file && canCreate && uploads) upload.mutate({ file, text });
    else if (text.trim()) propose.mutate(text.trim());
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
            <p className="text-xs font-semibold text-ink-muted">{message.role === "user" ? "You" : "Panda"}{message.inputType === "audio" ? " · Voice note" : message.inputType === "attachment" ? " · Attachment" : ""}</p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{message.text}</p>
            <time className="mt-2 block text-xs text-ink-muted" dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time>
            {message.role === "user" && message.status ? <p className="mt-2 text-xs text-ink-muted" role="status">{messageStatuses[message.status]}</p> : null}
            {message.role === "user" && message.status === "failed" && message.retryable && canAsk && enabled ? <Button className="mt-3" size="sm" variant="secondary" loading={retry.isPending && retry.variables === message.id} disabled={retry.isPending} onClick={() => retry.mutate(message.id)}>Retry message</Button> : null}
          </article>
        )) : <p className="py-5 text-center text-sm text-ink-muted">{canRead ? "Your messages for this project will appear here." : "Conversation history requires viewing permission for the records in this project."}</p>}
      </div>
      <div className="px-5"><ErrorMessage error={retry.error} /></div>
      {canAsk ? (
        <form onSubmit={submit} className="border-t border-line p-5">
          <label className="mb-2 block text-sm font-medium" htmlFor="site-message">Describe the site update</label>
          <textarea id="site-message" className={`${INPUT_BASE_CLASS} min-h-28 resize-y p-4`} value={text} onChange={(event) => setText(event.target.value)} maxLength={10_000} disabled={!enabled || pending} placeholder="Describe the site work, ask a project question, or add a correction…" />
          {canCreate && uploads ? <label className="mt-3 block text-sm font-medium">Attach a file<Input aria-label="Attach a file" className="mt-2" type="file" disabled={!enabled || pending} onChange={(event) => { setFile(event.target.files?.[0] ?? null); event.target.value = ""; }} /></label> : null}
          {file ? <p className="mt-2 text-sm text-ink-muted">{file.name} <button type="button" className="ml-2 underline" disabled={pending} onClick={() => setFile(null)}>Remove attachment</button></p> : null}
          {blockedFile ? <p role="alert" className="mt-2 text-sm text-warning-600">File access changed. Remove the attachment or refresh your access before sending.</p> : null}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-sm text-xs leading-5 text-ink-muted">{enabled ? "Ask questions by text or voice through your messaging app. Panda asks for missing details and prepares changes for your confirmation." : "Connect a messaging app and choose the project scope to ask Panda."}</p>
            <Button type="submit" disabled={!enabled || blockedFile || (!text.trim() && !file)} loading={pending}>Prepare review</Button>
          </div>
          <ErrorMessage error={propose.error ?? upload.error} />
        </form>
      ) : null}
    </section>
  );
}
