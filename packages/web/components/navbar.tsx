"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { nav, site } from "@/lib/site";
import { ButtonLink } from "@/components/ui";

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white/85 backdrop-blur">
      <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center" aria-label="BuildPanda home">
          <Image
            src="/logo.svg"
            alt="BuildPanda"
            width={132}
            height={36}
            priority
            className="h-8 w-auto"
          />
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? "text-brand"
                    : "text-muted hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 md:flex">
          <ButtonLink href="/about/#contact" variant="ghost" size="md" className="h-10 px-4">
            Talk to us
          </ButtonLink>
          <ButtonLink href={site.appUrl} variant="ghost" size="md" className="h-10 px-4">
            Log in
          </ButtonLink>
          <ButtonLink href="/#consultation" size="md" className="h-10 px-4">
            Book a consultation
          </ButtonLink>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line text-ink md:hidden"
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </nav>

      {open ? (
        <div className="border-t border-line bg-white md:hidden">
          <ul className="mx-auto flex w-full max-w-6xl flex-col px-5 py-3 sm:px-6">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block rounded-lg px-3 py-3 text-base font-medium ${
                    isActive(item.href) ? "text-brand" : "text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="mt-2">
              <ButtonLink href={site.appUrl} variant="ghost" size="md" className="w-full">
                Log in
              </ButtonLink>
            </li>
            <li className="mt-2">
              <ButtonLink href="/#consultation" size="md" className="w-full">
                Book a consultation
              </ButtonLink>
            </li>
          </ul>
        </div>
      ) : null}
    </header>
  );
}
