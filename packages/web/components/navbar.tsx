"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { nav, site, type NavItem } from "@/lib/site";
import { ButtonLink } from "@/components/ui";

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // The homepage hero is a dark panel and the nav sits on it, so on that one
  // route the bar overlays the panel and switches to light type. Everywhere
  // else it stays in flow, dark on the page ground.
  const onDark = pathname === "/";

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  function isChildActive(item: NavItem) {
    return Boolean(item.children?.some((child) => isActive(child.href)));
  }

  return (
    <header
      className={
        onDark
          ? "absolute inset-x-0 top-0 z-50 bg-transparent"
          : "relative z-50 bg-transparent"
      }
    >
      <nav className="site-container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center" aria-label="BuildPanda home">
          <Image
            src="/logo.svg"
            alt="BuildPanda"
            width={132}
            height={36}
            priority
            className={`h-8 w-auto ${onDark ? "brightness-0 invert" : ""}`}
          />
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {nav.map((item) =>
            item.children ? (
              <NavDropdown
                key={item.label}
                item={item}
                active={isChildActive(item)}
                isActive={isActive}
                onDark={onDark}
              />
            ) : (
              <li key={item.label}>
                <Link
                  href={item.href ?? "/"}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    onDark
                      ? "text-white/75 hover:text-white"
                      : isActive(item.href ?? "/")
                        ? "text-brand"
                        : "text-muted hover:text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ),
          )}
        </ul>

        <div className="hidden items-center gap-3 md:flex">
          <ButtonLink
            href={site.appUrl}
            variant="ghost"
            size="md"
            className={`h-10 px-4 ${onDark ? "text-white/75 hover:bg-white/10 hover:text-white" : ""}`}
          >
            Log in
          </ButtonLink>
          <ButtonLink
            href="/talk-to-us/"
            variant={onDark ? "white" : "primary"}
            size="md"
            className="h-10 px-4"
          >
            Book a demo
          </ButtonLink>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`inline-flex h-10 w-10 items-center justify-center rounded-lg md:hidden ${
            onDark ? "border border-white/25 text-white" : "border border-line text-ink"
          }`}
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
          <ul className="site-container flex flex-col py-3">
            {nav.map((item) =>
              item.children ? (
                <li key={item.label} className="flex flex-col">
                  <span className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted">
                    {item.label}
                  </span>
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={`block rounded-lg px-3 py-3 text-base font-medium ${
                        isActive(child.href) ? "text-brand" : "text-ink"
                      }`}
                    >
                      {child.label}
                    </Link>
                  ))}
                </li>
              ) : (
                <li key={item.label}>
                  <Link
                    href={item.href ?? "/"}
                    className={`block rounded-lg px-3 py-3 text-base font-medium ${
                      isActive(item.href ?? "/") ? "text-brand" : "text-ink"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ),
            )}
            <li className="mt-2">
              <ButtonLink href={site.appUrl} variant="ghost" size="md" className="w-full">
                Log in
              </ButtonLink>
            </li>
            <li className="mt-2">
              <ButtonLink href="/talk-to-us/" size="md" className="w-full">
                Book a demo
              </ButtonLink>
            </li>
          </ul>
        </div>
      ) : null}
    </header>
  );
}

function NavDropdown({
  item,
  active,
  isActive,
  onDark,
}: {
  item: NavItem;
  active: boolean;
  isActive: (href: string) => boolean;
  onDark: boolean;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLLIElement>(null);

  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }

  function cancelClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <li
      ref={containerRef}
      className="relative"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
          onDark
            ? "text-white/75 hover:text-white"
            : active || open
              ? "text-brand"
              : "text-muted hover:text-ink"
        }`}
      >
        {item.label}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 w-72 pt-2"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div className="flex flex-col gap-1 rounded-xl border border-line bg-white p-2 shadow-xl">
            {item.children?.map((child) => (
              <Link
                key={child.href}
                href={child.href}
                role="menuitem"
                className={`flex flex-col gap-0.5 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-faint ${
                  isActive(child.href) ? "bg-surface-faint" : ""
                }`}
              >
                <span
                  className={`text-sm font-semibold ${
                    isActive(child.href) ? "text-brand" : "text-ink"
                  }`}
                >
                  {child.label}
                </span>
                {child.description ? (
                  <span className="text-xs leading-relaxed text-muted">
                    {child.description}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </li>
  );
}
