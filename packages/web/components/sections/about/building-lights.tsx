import type { CSSProperties } from "react";

type Pane = { x: number; y: number; width: number; height: number };

// Window panes of public/about/buildings.svg, in its 219x204 coordinates.

/** The tower's floor bands, bottom floor first. The lower ones stop where the building in front begins. */
const TOWER_FLOORS: ReadonlyArray<Pane> = [
  { x: 89.42, y: 139.42, width: 18.88, height: 3.92 },
  { x: 89.42, y: 127.65, width: 18.88, height: 3.92 },
  { x: 89.42, y: 115.88, width: 18.88, height: 3.92 },
  { x: 89.42, y: 104.11, width: 18.88, height: 3.92 },
  { x: 89.42, y: 92.34, width: 18.88, height: 3.92 },
  { x: 89.42, y: 80.57, width: 18.88, height: 3.92 },
  { x: 89.42, y: 68.73, width: 33.55, height: 3.92 },
  { x: 89.42, y: 56.96, width: 33.55, height: 3.92 },
  { x: 89.42, y: 45.19, width: 33.55, height: 3.92 },
  { x: 89.42, y: 33.42, width: 33.55, height: 3.92 },
  { x: 89.42, y: 21.65, width: 33.55, height: 3.92 },
];

/** The apartment block's windows, row by row from the top. */
const BLOCK_WINDOWS: ReadonlyArray<Pane> = [
  { x: 115.79, y: 92.34, width: 7.18, height: 13.05 },
  { x: 127.28, y: 92.34, width: 7.18, height: 13.05 },
  { x: 138.84, y: 92.34, width: 7.18, height: 13.05 },
  { x: 115.79, y: 114.37, width: 7.18, height: 13.05 },
  { x: 127.28, y: 114.37, width: 7.18, height: 13.05 },
  { x: 138.84, y: 114.37, width: 7.18, height: 13.05 },
  { x: 115.79, y: 136.48, width: 7.18, height: 13.05 },
  { x: 127.28, y: 136.48, width: 7.18, height: 13.05 },
  { x: 138.84, y: 136.48, width: 7.18, height: 13.05 },
  { x: 115.79, y: 158.58, width: 7.18, height: 13.05 },
  { x: 127.28, y: 158.58, width: 7.18, height: 13.05 },
  { x: 138.84, y: 158.58, width: 7.18, height: 13.05 },
  { x: 115.79, y: 180.61, width: 7.18, height: 13.05 },
  { x: 127.28, y: 180.61, width: 7.18, height: 13.05 },
  { x: 138.84, y: 180.61, width: 7.18, height: 13.05 },
];

/** The house's two windows. */
const HOUSE_WINDOWS: ReadonlyArray<Pane> = [
  { x: 47.64, y: 151.19, width: 7.40, height: 13.73 },
  { x: 63.81, y: 151.19, width: 7.40, height: 13.73 },
];

// The block's windows come on and go off at their own pace. These repeat down
// the list; they share no common factor, so the pattern takes a long time to recur.
const BLOCK_PERIODS_S = [11, 17, 13, 19, 23];
const BLOCK_OFFSETS_S = [0.4, 6.1, 2.7, 9.3, 4.2, 12.8, 1.5];
const FLOOR_STEP_S = 0.45;

type BuildingLightsProps = {
  /** Seconds to shift every light by, so two copies of the drawing do not blink in unison. */
  phase?: number;
  className?: string;
};

/**
 * Lights for the buildings drawing, laid over it in the same coordinates.
 * The tower lights up floor by floor from the ground, like a build going up;
 * the apartment block's windows come and go like people at home; the house
 * stays lit. Timing lives in the `.light-*` rules in globals.css.
 */
export function BuildingLights({ phase = 0, className }: BuildingLightsProps) {
  const at = (seconds: number, period?: number) =>
    ({ "--at": `${seconds + phase}s`, ...(period ? { "--period": `${period}s` } : null) }) as CSSProperties;

  return (
    <svg viewBox="0 0 219 204" aria-hidden="true" className={className}>
      {TOWER_FLOORS.map((pane, index) => (
        <rect key={`floor-${index}`} {...pane} style={at(index * FLOOR_STEP_S)} className="light light-floor" />
      ))}
      {BLOCK_WINDOWS.map((pane, index) => (
        <rect
          key={`window-${index}`}
          {...pane}
          style={at(BLOCK_OFFSETS_S[index % BLOCK_OFFSETS_S.length], BLOCK_PERIODS_S[index % BLOCK_PERIODS_S.length])}
          className="light light-window"
        />
      ))}
      {HOUSE_WINDOWS.map((pane, index) => (
        <rect key={`house-${index}`} {...pane} style={at(1.2 + index * 0.6)} className="light light-home" />
      ))}
    </svg>
  );
}
