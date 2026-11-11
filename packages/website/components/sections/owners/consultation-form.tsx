"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Field } from "@/components/ui/field";
import { Select, type SelectOption } from "@/components/ui/select";
import { countries } from "@/content/countries";
import { owners } from "@/content/owners";
import { sendConsultationLead } from "@/lib/leads";

type Status = "idle" | "submitting" | "success" | "error";

const { form: copy } = owners.consultation;

/** Keyed by country code: the United States and Canada share +1, so the dial code alone cannot name one. */
const COUNTRY_OPTIONS: ReadonlyArray<SelectOption> = countries.map((country) => ({
  value: country.code,
  label: `${country.name} (${country.dial})`,
  short: country.dial,
}));
const DEFAULT_COUNTRY = countries[0].code;

/**
 * The consultation form. It maps its fields onto the lead endpoint's body
 * (see lib/leads.ts): the dialling code is joined to the number.
 */
export function ConsultationForm({
  projectType = copy.projectType,
  source = copy.source,
  submitLabel = copy.submit,
}: {
  /** What the enquiry is for; the lead endpoint requires one. */
  projectType?: string;
  /** Which page sent it, so the team knows the context. */
  source?: string;
  submitLabel?: string;
} = {}) {
  const [status, setStatus] = useState<Status>("idle");
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY);
  const dial = countries.find((country) => country.code === countryCode)?.dial ?? countries[0].dial;
  const confirmation = useRef<HTMLDivElement>(null);
  const phoneBox = useRef<HTMLDivElement>(null);

  // After sending, focus moves to the confirmation so it is read out.
  useEffect(() => {
    if (status === "success") confirmation.current?.focus();
  }, [status]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const value = (name: string) => String(data.get(name) ?? "").trim();
    const message = value("message");

    setStatus("submitting");
    try {
      await sendConsultationLead({
        name: value("fullName"),
        email: value("email"),
        phone: `${dial} ${value("phone")}`,
        location: value("location"),
        projectType,
        ...(message ? { message } : null),
        source,
      });
      form.reset();
      setCountryCode(DEFAULT_COUNTRY);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div ref={confirmation} tabIndex={-1} role="status" className="border border-line bg-white p-6 outline-none sm:p-8">
        <h3 className="text-xl font-semibold tracking-tight">{copy.success.title}</h3>
        <p className="mt-2 max-w-[28rem] leading-normal text-ink-soft">{copy.success.body}</p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-5 font-semibold text-brand underline underline-offset-4"
        >
          {copy.success.again}
        </button>
      </div>
    );
  }

  const submitting = status === "submitting";

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-2 gap-x-4 gap-y-5 border border-line bg-white p-4 sm:p-6">
      <Field htmlFor="consult-full-name" label={copy.fullName.label} className="col-span-2">
        <input
          id="consult-full-name"
          name="fullName"
          required
          maxLength={200}
          autoComplete="name"
          placeholder={copy.fullName.placeholder}
          className="field-input"
        />
      </Field>

      <Field htmlFor="consult-email" label={copy.email.label} className="col-span-2">
        <input
          id="consult-email"
          name="email"
          type="email"
          required
          maxLength={320}
          autoComplete="email"
          placeholder={copy.email.placeholder}
          className="field-input"
        />
      </Field>

      <Field htmlFor="consult-phone" label={copy.phone.label} className="col-span-2 sm:col-span-1">
        {/* The country and the number share one box; the box shows focus, not the two controls inside it. */}
        <div ref={phoneBox} className="field-group flex min-w-0">
          <div className="h-full w-[5.5rem] shrink-0 border-r border-line">
            <Select
              id="consult-country"
              ariaLabel={copy.phone.countryLabel}
              options={COUNTRY_OPTIONS}
              searchPlaceholder="Search countries"
              anchorRef={phoneBox}
              value={countryCode}
              onChange={setCountryCode}
              className="w-full"
            />
          </div>
          <input
            id="consult-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            required
            maxLength={30}
            pattern="[\d \-]{6,}"
            title={copy.phone.hint}
            autoComplete="tel-national"
            placeholder={dial}
            className="field-bare h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-ink-soft"
          />
        </div>
      </Field>
      <Field htmlFor="consult-location" label={copy.location.label} className="col-span-2 sm:col-span-1">
        <input
          id="consult-location"
          name="location"
          required
          maxLength={200}
          autoComplete="address-level2"
          placeholder={copy.location.placeholder}
          className="field-input"
        />
      </Field>

      <Field htmlFor="consult-message" label={copy.message.label} optional className="col-span-2">
        <textarea
          id="consult-message"
          name="message"
          rows={4}
          maxLength={5000}
          placeholder={copy.message.placeholder}
          className="field-input h-auto resize-y py-3"
        />
      </Field>

      <div className="col-span-2 mt-2">
        {status === "error" ? (
          <p role="alert" className="mb-3 text-sm text-danger">
            {copy.error}
          </p>
        ) : null}
        <button type="submit" disabled={submitting} className="btn btn-solid h-12 w-full disabled:opacity-70">
          {submitting ? copy.submitting : submitLabel}
        </button>
      </div>
    </form>
  );
}
