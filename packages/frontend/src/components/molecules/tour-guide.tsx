import { useEffect, useLayoutEffect, useState } from "react";
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

const PAD = 8;
const TOOLTIP_WIDTH = 320;
const GAP = 14;

function getRect(target: string): Rect | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function tooltipPosition(
  rect: Rect | null,
  placement: TourStep["placement"],
): { top: number; left: number } {
  if (!rect) {
    return {
      top: window.innerHeight / 2 - 80,
      left: window.innerWidth / 2 - TOOLTIP_WIDTH / 2,
    };
  }
  const place = placement ?? "bottom";
  let top: number;
  let left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;

  if (place === "top") top = rect.top - GAP - 160;
  else if (place === "left") {
    top = rect.top;
    left = rect.left - GAP - TOOLTIP_WIDTH;
  } else if (place === "right") {
    top = rect.top;
    left = rect.left + rect.width + GAP;
  } else top = rect.top + rect.height + GAP;

  left = Math.max(16, Math.min(left, window.innerWidth - TOOLTIP_WIDTH - 16));
  top = Math.max(16, Math.min(top, window.innerHeight - 200));
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

  useLayoutEffect(() => {
    if (!active || !step) return;
    function measure() {
      setRect(getRect(step!.target));
    }
    measure();
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
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

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/50 transition-opacity" onClick={onSkip} />

      {rect && (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-white/90 transition-all duration-200"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
          }}
        />
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

TourGuide.displayName = "TourGuide";
