/**
 * JS-side tokens only. Everything visual belongs in Tailwind classes
 * (tailwind.config.js mirrors the web palette) — these exist because
 * react-navigation options and layout maths can't read `className`.
 */
export const NavColors = {
  primary: "#004DE7",
  inactive: "#717171",
  surface: "#FFFFFF",
  border: "#EDEDED",
  background: "#FAFAFA",
} as const;

/** Phones stack; anything wider gets the tablet split. Matches the web `md` breakpoint. */
export const TabletMinWidth = 768;
