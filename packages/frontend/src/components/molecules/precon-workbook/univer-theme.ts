// BuildPanda's tokens, handed to the spreadsheet engine.
//
// Only the primary ramp and the font are overridden. Univer's own greys and
// status colours are left alone on purpose: replacing them wholesale is how a
// vendor component ends up with unreadable disabled text, and none of them
// carries BuildPanda meaning anyway.
//
// Every value below is read from DESIGN.md. Nothing here invents a colour.

import { defaultTheme, type Theme } from "@univerjs/presets";

/** DESIGN.md → Palette → Primary. `primary-500` is the brand blue. */
const PRIMARY = {
  50: "#E6EDFD",
  100: "#B0C8F8",
  200: "#8BACF1",
  300: "#5488EF",
  400: "#3371EE",
  500: "#004DE7",
  600: "#0046D2",
  700: "#0037A4",
  800: "#002A7F",
  900: "#002061",
} as const;

export const WORKBOOK_THEME: Theme = {
  ...defaultTheme,
  primary: { ...defaultTheme.primary, ...PRIMARY },
};

/** DESIGN.md → Typography → `--font-sans`. */
export const WORKBOOK_FONT = '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';

export { WORKBOOK_STYLES, generatedStyleFor } from "./workbook-styles";
