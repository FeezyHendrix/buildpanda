import type { CSSProperties } from "react";
import { lifecycleStages } from "@/content/lifecycle";
import { cn } from "@/lib/cn";

/**
 * The build's stages down the side of the hero, lit one at a time.
 * Set in Druk X-Condensed, the only place that face is used.
 */
export function LifecycleList({ className }: { className?: string }) {
  return (
    <ul
      aria-label="Project lifecycle"
      style={{ "--count": lifecycleStages.length } as CSSProperties}
      className={cn("text-right font-condensed text-[2.25rem] leading-[3rem] font-black tracking-[0.01em] uppercase", className)}
    >
      {lifecycleStages.map((stage, index) => (
        <li key={stage.name} style={{ "--i": index } as CSSProperties} className="lifecycle-item">
          {stage.name}
        </li>
      ))}
    </ul>
  );
}
