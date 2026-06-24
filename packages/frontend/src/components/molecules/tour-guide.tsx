import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/atoms/button";
import { cn } from "@/lib/utils";
import type { TourStep } from "@/hooks/use-tour";

interface TourGuideProps {
  active: boolean;
  step: TourStep | undefined;
  index: number;
  total: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 6;
const TOOLTIP_WIDTH = 320;
const TOOLTIP_HEIGHT = 220;
const GAP = 14;
const EDGE = 16;

function readRect(target: string): Rect | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function rectsEqual(a: Rect | null, b: Rect | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    Math.round(a.top) === Math.round(b.top) &&
    Math.round(a.left) === Math.round(b.left) &&
    Math.round(a.width) === Math.round(b.width) &&
    Math.round(a.height) === Math.round(b.height)
  );
}

function tooltipPosition(
  rect: Rect | null,
  placement: TourStep["placement"],
): { top: number; left: number } {
  if (!rect) {
    return {
      top: window.innerHeight / 2 - TOOLTIP_HEIGHT / 2,
      left: window.innerWidth / 2 - TOOLTIP_WIDTH / 2,
    };
  }

  const spaceBelow = window.innerHeight - (rect.top + rect.height);
  const spaceAbove = rect.top;
  const spaceRight = window.innerWidth - (rect.left + rect.width);
  const spaceLeft = rect.left;

  let place = placement ?? "bottom";
  if (place === "bottom" && spaceBelow < TOOLTIP_HEIGHT + GAP && spaceAbove > spaceBelow) {
    place = "top";
  } else if (place === "top" && spaceAbove < TOOLTIP_HEIGHT + GAP && spaceBelow > spaceAbove) {
    place = "bottom";
  } else if (place === "right" && spaceRight < TOOLTIP_WIDTH + GAP && spaceLeft > spaceRight) {
    place = "left";
  } else if (place === "left" && spaceLeft < TOOLTIP_WIDTH + GAP && spaceRight > spaceLeft) {
    place = "right";
  }

  let top: number;
  let left: number;

  if (place === "top") {
    top = rect.top - GAP - TOOLTIP_HEIGHT;
    left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
  } else if (place === "left") {
    top = rect.top + rect.height / 2 - TOOLTIP_HEIGHT / 2;
    left = rect.left - GAP - TOOLTIP_WIDTH;
  } else if (place === "right") {
    top = rect.top + rect.height / 2 - TOOLTIP_HEIGHT / 2;
    left = rect.left + rect.width + GAP;
  } else {
    top = rect.top + rect.height + GAP;
    left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
  }

  left = Math.max(EDGE, Math.min(left, window.innerWidth - TOOLTIP_WIDTH - EDGE));
  top = Math.max(EDGE, Math.min(top, window.innerHeight - TOOLTIP_HEIGHT - EDGE));
  return { top, left };
}

export function TourGuide({
  active,
  step,
  index,
  total,
  onNext,
  onBack,
  onSkip,
}: TourGuideProps) {
  const [rect, setRect] = useState<Rect | null>(null);
  const rectRef = useRef<Rect | null>(null);

  useLayoutEffect(() => {
    if (!active || !step) return;

    const target = step.target;
    const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
    el?.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });

    let frame = 0;
    let settleUntil = performance.now() + 450;

    const sync = () => {
      const next = readRect(target);
      if (!rectsEqual(next, rectRef.current)) {
        rectRef.current = next;
        setRect(next);
      }
    };

    const loop = () => {
      sync();
      if (performance.now() < settleUntil) {
        frame = window.requestAnimationFrame(loop);
      }
    };
    frame = window.requestAnimationFrame(loop);

    const restart = () => {
      settleUntil = performance.now() + 200;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(loop);
    };

    const observer = el ? new ResizeObserver(restart) : null;
    if (el) observer?.observe(el);
    window.addEventListener("resize", restart);
    window.addEventListener("scroll", restart, true);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", restart);
      window.removeEventListener("scroll", restart, true);
    };
  }, [active, step, index]);

  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onSkip();
      else if (e.key === "ArrowRight" || e.key === "Enter") onNext();
      else if (e.key === "ArrowLeft") onBack();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onSkip, onNext, onBack]);

  if (!active || !step) return null;

  const tip = tooltipPosition(rect, step.placement);
  const isLast = index === total - 1;

  const hole = rect
    ? {
        top: Math.max(0, rect.top - PAD),
        left: Math.max(0, rect.left - PAD),
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      {hole ? (
        <>
          <div
            className="absolute left-0 right-0 top-0 bg-black/55"
            style={{ height: hole.top }}
            onClick={onSkip}
          />
          <div
            className="absolute left-0 bg-black/55"
            style={{ top: hole.top, height: hole.height, width: hole.left }}
            onClick={onSkip}
          />
          <div
            className="absolute right-0 bg-black/55"
            style={{
              top: hole.top,
              height: hole.height,
              left: hole.left + hole.width,
            }}
            onClick={onSkip}
          />
          <div
            className="absolute bottom-0 left-0 right-0 bg-black/55"
            style={{ top: hole.top + hole.height }}
            onClick={onSkip}
          />
          <div
            className="pointer-events-none absolute rounded-xl ring-2 ring-[#004DE7] ring-offset-2 ring-offset-transparent transition-[top,left,width,height] duration-150 ease-out"
            style={{
              top: hole.top,
              left: hole.left,
              width: hole.width,
              height: hole.height,
            }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-black/55" onClick={onSkip} />
      )}

      <div
        className="absolute w-[320px] rounded-2xl bg-white p-5 shadow-xl"
        style={{ top: tip.top, left: tip.left }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#004DE7]">
            Step {index + 1} of {total}
          </span>
          <button
            type="button"
            onClick={onSkip}
            className="text-xs font-medium text-gray-400 outline-none hover:text-gray-700"
          >
            Skip tour
          </button>
        </div>

        <h3 className="mt-2 text-base font-semibold text-gray-900">{step.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{step.body}</p>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index ? "w-4 bg-[#004DE7]" : "w-1.5 bg-gray-200",
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <Button variant="secondary" size="sm" onClick={onBack}>
                Back
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={onNext}>
              {isLast ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
