/**
 * Icon set for the material log.
 *
 * Every ledger signal (IN / USED / VOID, negative stock, time flag) must be
 * readable without relying on colour — WCAG 1.4.1 — so each one is paired with
 * a distinct shape from this set. Icons inherit `currentColor`, which lets the
 * Badge atom own the palette.
 */

interface IconProps {
  className?: string;
}

const STROKE = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** Material received onto site — arrow travelling down into a tray. */
export function ArrowIntoSiteIcon({ className }: IconProps) {
  return (
    <svg {...STROKE} className={className} aria-hidden="true">
      <path d="M12 3v10" />
      <path d="M8 9l4 4 4-4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

/** Material consumed on site — arrow travelling up out of a tray. */
export function ArrowOutOfSiteIcon({ className }: IconProps) {
  return (
    <svg {...STROKE} className={className} aria-hidden="true">
      <path d="M12 14V4" />
      <path d="M8 8l4-4 4 4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

/** Reversing entry — a counter-clockwise undo arrow. */
export function ReversalIcon({ className }: IconProps) {
  return (
    <svg {...STROKE} className={className} aria-hidden="true">
      <path d="M3 5v6h6" />
      <path d="M3.5 11a9 9 0 1 1 1.4 6.4" />
    </svg>
  );
}

/** Dispute-relevant warning — negative stock. */
export function AlertTriangleIcon({ className }: IconProps) {
  return (
    <svg {...STROKE} className={className} aria-hidden="true">
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

/** Dispute-relevant warning — the recorded time looks wrong. */
export function ClockAlertIcon({ className }: IconProps) {
  return (
    <svg {...STROKE} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

/** Reorder policy. */
export function ClipboardCheckIcon({ className }: IconProps) {
  return (
    <svg {...STROKE} className={className} aria-hidden="true">
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 14l2 2 4-4" />
    </svg>
  );
}

/** Stock on hand — stacked layers. */
export function StackIcon({ className }: IconProps) {
  return (
    <svg {...STROKE} className={className} aria-hidden="true">
      <path d="M3 8l9-5 9 5-9 5-9-5z" />
      <path d="M3 13l9 5 9-5" />
      <path d="M3 18l9 5 9-5" />
    </svg>
  );
}

/** Photo proof attached to an entry. */
export function PaperclipIcon({ className }: IconProps) {
  return (
    <svg {...STROKE} className={className} aria-hidden="true">
      <path d="M21.4 11.1 12.3 20.2a5.5 5.5 0 0 1-7.8-7.8l9.2-9.1a3.7 3.7 0 0 1 5.2 5.2l-9.2 9.1a1.8 1.8 0 0 1-2.6-2.6l8.5-8.4" />
    </svg>
  );
}

export type { IconProps };
