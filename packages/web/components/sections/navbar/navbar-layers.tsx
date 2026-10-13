"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useSectionClip } from "@/components/motion/use-section-clip";
import { isNavMenu, navEntries } from "@/content/nav";
import { cn } from "@/lib/cn";
import { navConfig, NAV_THEMES, type NavTheme } from "@/lib/themes";
import { NavbarBar } from "./navbar-bar";
import { DropdownPanel, MobilePanel } from "./navbar-menu";

const FOCUSABLE = "a[href], button";

/**
 * The fixed header. It stacks one bar per theme and lets `useSectionClip`
 * reveal each one only where its sections are. Menu state lives here so the
 * three bars stay in step and the panels render once.
 */
export function NavbarLayers() {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const layerRefs = useRef<Partial<Record<NavTheme, HTMLElement | null>>>({});
  const nav = navConfig(pathname);
  const initialTheme = nav.theme;
  const previousLive = useRef<NavTheme>(initialTheme);

  const [live, setLive] = useState<NavTheme>(initialTheme);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuLeft, setMenuLeft] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  useSectionClip(headerRef, layerRefs, setLive, pathname, nav.locked ? nav.theme : undefined);

  const liveItem = useCallback(
    (id: string) => layerRefs.current[live]?.querySelector<HTMLElement>(`[data-nav-item="${id}"]`) ?? null,
    [live],
  );

  // Keyboard focus follows its control into the layer that just became live.
  useEffect(() => {
    const from = layerRefs.current[previousLive.current];
    previousLive.current = live;
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !from?.contains(active)) return;
    const id = active.dataset.navItem;
    if (id) liveItem(id)?.focus({ preventScroll: true });
  }, [live, liveItem]);

  const closeMenus = useCallback(() => {
    setOpenMenuId(null);
    setMobileOpen(false);
  }, []);

  const toggleMenu = (id: string) => {
    const trigger = liveItem(id);
    if (trigger) setMenuLeft(trigger.getBoundingClientRect().left);
    setOpenMenuId((current) => (current === id ? null : id));
  };

  const anyOpen = openMenuId !== null || mobileOpen;

  // Keep the dropdown under its trigger while the window is resized.
  useEffect(() => {
    if (!openMenuId) return;
    const place = () => {
      const trigger = liveItem(openMenuId);
      if (trigger) setMenuLeft(trigger.getBoundingClientRect().left);
    };
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [openMenuId, liveItem]);

  useEffect(() => {
    if (!anyOpen) return;
    const header = headerRef.current;

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const returnTo = openMenuId ?? "mobile-menu";
      closeMenus();
      liveItem(returnTo)?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !header?.contains(event.target)) closeMenus();
    };
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && !header?.contains(event.target)) closeMenus();
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("focusin", onFocusIn);
    // The two panels belong to different breakpoints; close when crossing it.
    const desktop = window.matchMedia("(min-width: 768px)");
    desktop.addEventListener("change", closeMenus);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("focusin", onFocusIn);
      desktop.removeEventListener("change", closeMenus);
    };
  }, [anyOpen, openMenuId, closeMenus, liveItem]);

  // The dropdown sits after the bars in the DOM, so Tab is routed by hand:
  // trigger → first item, last item → the control after the trigger.
  const onBarKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!openMenuId || event.target !== liveItem(openMenuId)) return;
    const forward = (event.key === "Tab" && !event.shiftKey) || event.key === "ArrowDown";
    if (!forward) return;
    const first = headerRef.current?.querySelector<HTMLElement>("[data-nav-dropdown] a[href]");
    if (!first) return;
    event.preventDefault();
    first.focus();
  };

  const onDropdownKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab" || !openMenuId) return;
    const links = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("a[href]"));
    const trigger = liveItem(openMenuId);
    if (event.shiftKey && event.target === links[0]) {
      event.preventDefault();
      trigger?.focus();
    } else if (!event.shiftKey && event.target === links[links.length - 1]) {
      const controls = Array.from(layerRefs.current[live]?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (control) => control.offsetParent !== null,
      );
      const next = trigger ? controls[controls.indexOf(trigger) + 1] : undefined;
      if (!next) return;
      event.preventDefault();
      setOpenMenuId(null);
      next.focus();
    }
  };

  const menus = navEntries.filter(isNavMenu);
  const openMenu = menus.find((entry) => entry.id === openMenuId);
  // What the panel shows: the open menu, or the last one while it animates closed.
  const [shownMenuId, setShownMenuId] = useState(menus[0]?.id);
  if (openMenu && openMenu.id !== shownMenuId) setShownMenuId(openMenu.id);
  const dropdownMenu = menus.find((entry) => entry.id === shownMenuId);

  return (
    <header ref={headerRef} data-nav-surface={nav.surface} className="fixed inset-x-0 top-0 z-50 h-(--nav-height)">
      {NAV_THEMES.map((theme) => (
        <div
          key={theme}
          ref={(node) => {
            layerRefs.current[theme] = node;
          }}
          data-theme={theme}
          data-initial={theme === initialTheme ? "" : undefined}
          aria-hidden={theme === live ? undefined : true}
          onKeyDown={theme === live ? onBarKeyDown : undefined}
          className={cn(
            "nav-theme nav-layer border-b border-(--surface-outline)",
            // A bar in the page's own colour keeps its hairline at every width.
            nav.surface !== "page" && "md:border-b-0",
          )}
        >
          <NavbarBar
            live={theme === live}
            openMenuId={openMenuId}
            mobileOpen={mobileOpen}
            onToggleMenu={toggleMenu}
            onToggleMobile={() => {
              setOpenMenuId(null);
              setMobileOpen((open) => !open);
            }}
          />
        </div>
      ))}

      {/* Always mounted so it can animate closed as well as open; inert while closed. */}
      {dropdownMenu ? (
        <div data-nav-dropdown>
          <DropdownPanel
            menu={dropdownMenu}
            open={openMenu !== undefined}
            theme={live}
            left={menuLeft}
            onKeyDown={onDropdownKeyDown}
            onNavigate={closeMenus}
          />
        </div>
      ) : null}
      <MobilePanel open={mobileOpen} theme={live} onNavigate={closeMenus} />
    </header>
  );
}
