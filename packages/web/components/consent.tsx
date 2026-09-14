"use client";

import Link from "next/link";
import Script from "next/script";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "buildpanda-consent";
const CHANGED_EVENT = "buildpanda-consent-changed";

export type Consent = "analytics" | "essential";

/**
 * Consent is stored on the device, never sent anywhere, and defaults to
 * nothing: until somebody chooses, no analytics script is loaded at all. That
 * default is the point of the thing — both the GDPR and the NDPR treat
 * analytics as needing consent first, not an opt-out afterwards.
 */
function read(): Consent | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "analytics" || value === "essential" ? value : null;
  } catch {
    // Private browsing, or storage blocked. Treat it as no choice made and
    // load nothing; the banner reappearing is the safe failure.
    return null;
  }
}

export function useConsent() {
  const [consent, setConsent] = useState<Consent | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setConsent(read());
    setReady(true);
    const sync = () => setConsent(read());
    window.addEventListener(CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const choose = useCallback((value: Consent | null) => {
    try {
      if (value === null) window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Nothing to persist to; the choice still applies for this page view.
    }
    window.dispatchEvent(new Event(CHANGED_EVENT));
  }, []);

  return { consent, ready, choose };
}

/** Loads Google Analytics only once analytics have been agreed to. */
export function Analytics({ measurementId }: { measurementId: string }) {
  const { consent } = useConsent();
  if (consent !== "analytics") return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}', { anonymize_ip: true });
        `}
      </Script>
    </>
  );
}

/**
 * Sits above the sticky call to action and hides it while a choice is pending,
 * so the foot of the page never carries two bars at once.
 */
export function ConsentBanner() {
  const { consent, ready, choose } = useConsent();
  const open = ready && consent === null;

  useEffect(() => {
    if (open) document.body.setAttribute("data-consent-open", "");
    else document.body.removeAttribute("data-consent-open");
    return () => document.body.removeAttribute("data-consent-open");
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="region"
      aria-label="Cookies and data"
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-line bg-white/95 backdrop-blur"
    >
      <div className="site-container flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
        <p className="max-w-3xl text-sm leading-relaxed text-muted">
          We use cookies that are needed to run the site, and, only if you agree,
          analytics that tell us which pages people read. You can change your
          mind at any time from the footer. See our{" "}
          <ConsentLink href="/privacy/">Privacy Policy</ConsentLink>,{" "}
          <ConsentLink href="/data-policy/">Data Policy</ConsentLink> and{" "}
          <ConsentLink href="/terms-of-service/">Terms</ConsentLink>. We handle
          personal data under the Nigeria Data Protection Regulation and, where
          it applies to you, the UK and EU GDPR.
        </p>

        <div className="flex flex-shrink-0 flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => choose("essential")}
            className="inline-flex h-10 items-center justify-center rounded-md border border-line px-4 text-sm font-semibold text-ink transition-colors hover:border-brand hover:text-brand"
          >
            Essential only
          </button>
          <button
            type="button"
            onClick={() => choose("analytics")}
            className="inline-flex h-10 items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
          >
            Accept analytics
          </button>
        </div>
      </div>
    </div>
  );
}

function ConsentLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium text-brand underline underline-offset-2">
      {children}
    </Link>
  );
}

/** Footer control: clears the stored choice so the banner comes back. */
export function ConsentReset() {
  const { consent, ready, choose } = useConsent();
  if (!ready || consent === null) return null;

  return (
    <button
      type="button"
      onClick={() => choose(null)}
      className="text-sm text-white/70 underline-offset-2 hover:text-white hover:underline"
    >
      Cookie settings
    </button>
  );
}
