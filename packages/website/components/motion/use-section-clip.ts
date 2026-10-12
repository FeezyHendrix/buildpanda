"use client";

import { useEffect, type RefObject } from "react";
import { NAV_THEMES, type NavTheme } from "@/lib/themes";

type Slice = { theme: NavTheme; top: number; bottom: number };

const HIDDEN = "inset(0 0 100% 0)";
const SECTION_SELECTOR = "[data-nav-theme]";

function isNavTheme(value: string | undefined): value is NavTheme {
  return NAV_THEMES.some((theme) => theme === value);
}

/** The vertical slice of the bar (0 to `height`) that each themed section sits behind. */
function measureSlices(height: number): Slice[] {
  const sections = Array.from(document.querySelectorAll<HTMLElement>(SECTION_SELECTOR));
  // Snap to device pixels so two neighbouring layers meet without a hairline gap.
  const dpr = window.devicePixelRatio || 1;
  const snap = (value: number) => Math.round(Math.min(Math.max(value, 0), height) * dpr) / dpr;

  const slices: Slice[] = [];
  let lastAbove: NavTheme | undefined;
  let first: NavTheme | undefined;

  for (const section of sections) {
    const theme = section.dataset.navTheme;
    if (!isNavTheme(theme)) continue;
    first ??= theme;
    const rect = section.getBoundingClientRect();
    if (rect.bottom <= 0) lastAbove = theme;
    const top = snap(rect.top);
    const bottom = snap(rect.bottom);
    if (bottom > top) slices.push({ theme, top, bottom });
  }

  if (slices.length === 0) {
    // Nothing is behind the bar: keep the nearest section's colours.
    const theme = lastAbove ?? first;
    return theme ? [{ theme, top: 0, bottom: height }] : [];
  }

  // Close any gap (overscroll, unmarked elements) so the bar is always fully painted.
  slices.sort((a, b) => a.top - b.top);
  slices[0].top = 0;
  slices[slices.length - 1].bottom = height;
  for (let i = 0; i < slices.length - 1; i++) slices[i].bottom = slices[i + 1].top;
  return slices;
}

/**
 * Clips each themed navbar layer to the part of the bar its sections are
 * behind, so the colour change follows the section boundary exactly. Styles
 * are written straight to the layers: nothing re-renders while scrolling.
 * `onLive` is called only when the theme covering most of the bar changes.
 */
export function useSectionClip(
  headerRef: RefObject<HTMLElement | null>,
  layerRefs: RefObject<Partial<Record<NavTheme, HTMLElement | null>>>,
  onLive: (theme: NavTheme) => void,
  /** Re-measure when this changes (the route). */
  key: string,
  /** Show this theme for the whole page and ignore the sections. */
  lockedTheme?: NavTheme,
) {
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    if (lockedTheme) {
      for (const theme of NAV_THEMES) {
        const layer = layerRefs.current[theme];
        if (layer) layer.style.clipPath = theme === lockedTheme ? "none" : HIDDEN;
      }
      onLive(lockedTheme);
      return;
    }

    let frame = 0;
    let live: NavTheme | undefined;

    const update = () => {
      frame = 0;
      const height = header.offsetHeight;
      const slices = measureSlices(height);
      if (slices.length === 0) return;

      let tallest = slices[0];
      for (const theme of NAV_THEMES) {
        const layer = layerRefs.current[theme];
        if (!layer) continue;
        const own = slices.filter((slice) => slice.theme === theme);
        if (own.length === 0) {
          layer.style.clipPath = HIDDEN;
          continue;
        }
        const top = Math.min(...own.map((slice) => slice.top));
        const bottom = Math.max(...own.map((slice) => slice.bottom));
        layer.style.clipPath = `inset(${top}px 0 ${height - bottom}px 0)`;
      }
      for (const slice of slices) {
        if (slice.bottom - slice.top > tallest.bottom - tallest.top) tallest = slice;
      }
      if (tallest.theme !== live) {
        live = tallest.theme;
        onLive(live);
      }
    };

    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(document.documentElement);
    observer.observe(document.body);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
    };
  }, [headerRef, layerRefs, onLive, key, lockedTheme]);
}
