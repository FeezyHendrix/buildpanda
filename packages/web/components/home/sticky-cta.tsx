"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { site } from "@/lib/site";

const DISMISS_KEY = "bp-sticky-cta-dismissed";

// Fixed to the viewport, so it never reflows the page when it appears: no
// layout shift. The homepage carries no form fields, so there is nothing on a
// phone for it to cover except a strip of the band it is floating over.
export function StickyCta() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(DISMISS_KEY);
    } catch {
      stored = null;
    }
    if (stored === "1") return;
    setDismissed(false);

    const sentinel = document.getElementById("hero-end");
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  if (dismissed) return null;

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur transition-transform duration-200 ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
      aria-hidden={!visible}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-2 sm:px-6 lg:px-8">
        <p className="hidden min-w-0 flex-1 truncate text-sm font-semibold text-ink sm:block">
          Progress you can verify. Payments you can defend.
        </p>
        <div className="flex flex-1 items-center gap-2 sm:flex-none">
          <Link
            href={site.appUrl}
            tabIndex={visible ? undefined : -1}
            className="inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover sm:flex-none"
          >
            Start free
          </Link>
          <Link
            href="/talk-to-us/"
            tabIndex={visible ? undefined : -1}
            className="inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-line px-4 text-sm font-semibold text-ink hover:border-brand hover:text-brand sm:flex-none"
          >
            Talk to us
          </Link>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          tabIndex={visible ? undefined : -1}
          onClick={() => {
            try {
              window.localStorage.setItem(DISMISS_KEY, "1");
            } catch {
              /* private browsing: it just comes back next visit */
            }
            setDismissed(true);
          }}
          className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-ink"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
