"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { contractors } from "@/content/contractors";
import { cn } from "@/lib/cn";

const { solutions } = contractors;
const items = solutions.items;

/**
 * Desktop solutions: a vertical tab list of product areas beside a blue panel
 * showing the selected area's screenshot. Up/Down/Home/End move and select.
 * The selected card's blue bar is a timer: when it has filled, the next area
 * is selected (see `.solution-progress` in globals.css for when it holds).
 */
export function SolutionsTabs({ className }: { className?: string }) {
  const [active, setActive] = useState(0);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const baseId = useId();
  const tabId = (index: number) => `${baseId}-tab-${index}`;
  const panelId = `${baseId}-panel`;
  const current = items[active];
  const root = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(false);

  // The timer only runs while the section is on screen, so a visitor arrives at it from the start.
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.25 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  function select(index: number) {
    const next = (index + items.length) % items.length;
    setActive(next);
    tabs.current[next]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, number> = {
      ArrowDown: active + 1,
      ArrowUp: active - 1,
      Home: 0,
      End: items.length - 1,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    select(moves[event.key]);
  }

  return (
    <div
      ref={root}
      data-paused={onScreen ? undefined : ""}
      className={cn("solutions-tabs grid grid-cols-[minmax(0,477fr)_minmax(0,643fr)] items-start gap-x-20", className)}
    >
      <div
        role="tablist"
        aria-orientation="vertical"
        aria-label={solutions.listLabel}
        onKeyDown={onKeyDown}
        className="border border-line"
      >
        {items.map((item, index) => {
          const selected = index === active;

          return (
            <button
              key={item.id}
              ref={(node) => {
                tabs.current[index] = node;
              }}
              id={tabId(index)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(index)}
              className={cn(
                "relative block w-full p-6 text-left transition-colors duration-300 ease-out not-first:border-t not-first:border-line focus-visible:z-10",
                selected ? "bg-card" : "hover:bg-card/50",
              )}
            >
              {selected ? (
                // The timer: a hairline track down the left edge that fills with blue, then moves on.
                <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-line">
                  <span
                    key={active}
                    className="solution-progress absolute inset-0 bg-brand"
                    onAnimationEnd={() => setActive((index) => (index + 1) % items.length)}
                  />
                </span>
              ) : null}
              <span className="block text-[1.75rem] leading-tight font-semibold tracking-[-0.02em]">{item.title}</span>
              <span className="mt-4 block text-lg leading-normal text-pretty text-ink-soft">{item.description}</span>
            </button>
          );
        })}
      </div>

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={tabId(active)}
        className="sticky top-[calc(var(--nav-height)+1.5rem)] aspect-[643/743] overflow-hidden bg-brand"
      >
        <div aria-hidden="true" className="grain" />
        {/* All six are loaded with the section so switching never shows an empty panel; the selected one fades in over the last. */}
        {items.map((item) => {
          const selected = item.id === current.id;

          return (
            <Image
              key={item.id}
              src={item.src}
              width={solutions.image.width}
              height={solutions.image.height}
              alt={selected ? item.alt : ""}
              aria-hidden={selected ? undefined : true}
              sizes="(min-width: 1440px) 610px, 42vw"
              className={cn(
                "absolute right-0 bottom-0 h-auto w-[94%] max-w-none transition-opacity duration-300 ease-out motion-reduce:transition-none",
                !selected && "opacity-0",
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
