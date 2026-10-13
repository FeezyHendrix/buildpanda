import type { CSSProperties } from "react";
import { Logo } from "@/components/ui/logo";
import { fragmentation } from "@/content/fragmentation";
import { lifecycleStages } from "@/content/lifecycle";

const COLUMNS = 3;

/**
 * The wide panel: BuildPanda at the top, connected to every stage of the build.
 * A blue pulse keeps travelling out of the logo, along the
 * wires and around each column of stages (see `.diagram-*` in globals.css).
 */
export function PlatformDiagram() {
  const stages = lifecycleStages.filter((stage) => stage.detail !== null);

  return (
    <div className="diagram">
      <div aria-hidden="true" className="diagram-head">
        <span className="diagram-wire diagram-rail diagram-rail-start" />
        <span className="diagram-wire diagram-rail diagram-rail-end" />
        <span className="diagram-wire diagram-drop diagram-drop-start" />
        <span className="diagram-wire diagram-drop diagram-drop-middle" />
        <span className="diagram-wire diagram-drop diagram-drop-end" />
        <span className="diagram-logo">
          <Logo className="h-7 w-auto" />
        </span>
      </div>

      <div className="relative">
        <ol aria-label={fragmentation.platform.listLabel} className="diagram-stages">
          {stages.map((stage) => (
            <li
              key={stage.name}
              className="diagram-stage"
            >
              <p className="text-[0.9375rem] font-medium">{stage.name}</p>
              <p className="mt-0.5 text-[0.8125rem] text-ink-soft">{stage.detail}</p>
            </li>
          ))}
        </ol>

        {/* One outline per column of stages, for the pulse to run around. */}
        {Array.from({ length: COLUMNS }, (_, column) => (
          <span
            key={column}
            aria-hidden="true"
            style={{ "--column": column } as CSSProperties}
            className="diagram-trace"
          />
        ))}
      </div>
    </div>
  );
}
