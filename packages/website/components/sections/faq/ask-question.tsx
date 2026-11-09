"use client";

import { useState, type FormEvent } from "react";
import { sendQuestion } from "@/lib/leads";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; email: string } | { kind: "error" };

/**
 * When the FAQ does not answer it, the question goes to the team, who reply
 * by email. The hidden "company" field is a honeypot: people never see it,
 * so a filled one marks a bot and the backend drops it quietly.
 */
export function AskQuestion({ question }: { question: string }) {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (state.kind === "sending") return;
    setState({ kind: "sending" });
    try {
      await sendQuestion({ email: email.trim(), question: question.trim(), company });
      setState({ kind: "sent", email: email.trim() });
    } catch {
      setState({ kind: "error" });
    }
  }

  if (state.kind === "sent") {
    return (
      <p role="status" className="mt-4 border border-line bg-white px-4 py-4 text-[0.9375rem]">
        Thanks — your question is with the team. We reply to <strong>{state.email}</strong> within one business day.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 border border-line bg-white px-4 py-4">
      <p className="text-[0.9375rem]">
        Didn&apos;t find your answer? Send <span className="font-semibold">“{question.trim()}”</span> to our team and we&apos;ll reply by email.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="ask-email" className="sr-only">Your email address</label>
        <input
          id="ask-email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
          className="h-11 flex-1 border border-line bg-white px-3 text-[0.9375rem] placeholder:text-ink-soft"
        />
        {/* Honeypot: off-screen and out of the tab order, so only bots fill it. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label htmlFor="ask-company">Company</label>
          <input id="ask-company" tabIndex={-1} autoComplete="off" value={company} onChange={(event) => setCompany(event.target.value)} />
        </div>
        <button
          type="submit"
          disabled={state.kind === "sending"}
          className="h-11 rounded-full bg-brand px-5 text-[0.9375rem] font-semibold text-white disabled:opacity-60"
        >
          {state.kind === "sending" ? "Sending…" : "Send question"}
        </button>
      </div>
      {state.kind === "error" ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          That didn&apos;t send. Check your email address, or try again in a few minutes.
        </p>
      ) : null}
    </form>
  );
}
