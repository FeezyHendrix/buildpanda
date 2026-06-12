"use client";

import { useState, type FormEvent } from "react";
import { projectTypes } from "@/lib/site";
import { CheckIcon } from "@/components/icons";

type Status = "idle" | "submitting" | "success" | "error";

// Backend lead-capture endpoint (POST /leads/consultation emails the lead to
// the team inbox). Overridable per environment; in dev with no override the
// submission is logged to the console instead.
const endpoint =
  process.env.NEXT_PUBLIC_LEADS_ENDPOINT ||
  (process.env.NODE_ENV === "production"
    ? "https://api.buildpanda.com/leads/consultation"
    : undefined);

const fieldClass =
  "h-[50px] w-full rounded-lg border border-line bg-white px-4 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/15";

export function ConsultationForm() {
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");

    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    try {
      if (endpoint) {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, source: "buildpanda.io" }),
        });
        if (!res.ok) throw new Error("Request failed");
      } else {
        // No endpoint configured yet — log so the lead is not lost in dev.
        // eslint-disable-next-line no-console
        console.info("Consultation request", data);
      }
      form.reset();
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-line bg-white p-10 text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success">
          <CheckIcon className="h-7 w-7" />
        </span>
        <h3 className="text-xl font-semibold text-ink">Request received</h3>
        <p className="max-w-sm text-sm leading-relaxed text-muted">
          Thank you. A BuildPanda advisor will reach out within one business day
          to schedule your consultation and map out the next steps for your
          build.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="text-sm font-semibold text-brand hover:text-brand-hover"
        >
          Submit another request
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6 sm:p-8"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="name">
          <input id="name" name="name" required className={fieldClass} placeholder="Your full name" />
        </Field>
        <Field label="Email address" htmlFor="email">
          <input id="email" name="email" type="email" required className={fieldClass} placeholder="you@email.com" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone / WhatsApp" htmlFor="phone">
          <input id="phone" name="phone" required className={fieldClass} placeholder="+234 ..." />
        </Field>
        <Field label="Build location" htmlFor="location">
          <input id="location" name="location" required className={fieldClass} placeholder="City / State in Nigeria" />
        </Field>
      </div>

      <Field label="What are you planning?" htmlFor="projectType">
        <select id="projectType" name="projectType" required defaultValue="" className={`${fieldClass} appearance-none`}>
          <option value="" disabled>
            Select a project type
          </option>
          {projectTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Tell us a little more (optional)" htmlFor="message">
        <textarea
          id="message"
          name="message"
          rows={4}
          className="w-full rounded-lg border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/15"
          placeholder="Where are you based, your timeline, budget range, or any questions."
        />
      </Field>

      {status === "error" ? (
        <p className="rounded-lg bg-[#FDECEC] px-4 py-3 text-sm text-danger">
          Something went wrong. Please try again or email hello@buildpanda.io.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-1 inline-flex h-[50px] items-center justify-center rounded-lg bg-brand px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-hover active:bg-brand-active disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "submitting" ? "Sending..." : "Book my consultation"}
      </button>

      <p className="text-center text-xs text-muted">
        No obligation. We respond within one business day.
      </p>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-2">
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}
