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

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  function isChildActive(item: NavItem) {
    return Boolean(item.children?.some((child) => isActive(child.href)));
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
          {nav.map((item) =>
            item.children ? (
              <NavDropdown
                key={item.label}
                item={item}
                active={isChildActive(item)}
                isActive={isActive}
              />
            ) : (
              <li key={item.label}>
                <Link
                  href={item.href ?? "/"}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    isActive(item.href ?? "/")
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
          <ButtonLink href={site.appUrl} variant="ghost" size="md" className="h-10 px-4">
            Log in
          </ButtonLink>
          <ButtonLink href={site.appUrl} size="md" className="h-10 px-4">
            Get started
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
              <ButtonLink href={site.appUrl} size="md" className="w-full">
                Get started
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
}: {
  item: NavItem;
  active: boolean;
  isActive: (href: string) => boolean;
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
          active || open ? "text-brand" : "text-muted hover:text-ink"
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
