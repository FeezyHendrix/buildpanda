import { palette } from "./colors";

/**
 * JS-side tokens only. Everything visual belongs in Tailwind classes
 * (tailwind.config.js mirrors the web palette) — these exist because
 * react-navigation options and layout maths can't read `className`.
 */
export const NavColors = {
  primary: palette.primary500,
  inactive: palette.grey400,
  surface: palette.surface,
  border: palette.grey50,
  background: palette.canvas,
} as const;

/** Phones stack; anything wider gets the tablet split. Matches the web `md` breakpoint. */
export const TabletMinWidth = 768;
