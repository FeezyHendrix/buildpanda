/**
 * Palette values for the places `className` cannot reach: Ionicon `color=`
 * props, react-navigation options, canvas/DOM CSS strings.
 *
 * NativeWind and these values read the same v2 token snapshot.
 */
import { colors } from "./design-tokens.json";

export const palette = {
  primary500: colors.primary[500],
  surface: colors.surface,
  surfaceAlt: colors["surface-alt"],
  canvas: colors.canvas,
  hairline: colors.hairline,
  success500: colors.success[500],
  success600: colors.success[600],
  success700: colors.success[700],
  error500: colors.error[500],
  error600: colors.error[600],
  warning600: colors.warning[600],
  amber700: colors.warning[700],
  grey50: colors.grey[50],
  grey100: colors.grey[100],
  grey200: colors.grey[200],
  grey300: colors.grey[300],
  grey400: colors["ink-muted"],
  grey600: colors["ink-subtle"],
  black500: colors.ink,
} as const;

/** BuildPanda blue: the active, actionable icon. */
export const ICON_BRAND = palette.primary500;
/** Body-text black for an icon that reads as content. */
export const ICON_DEFAULT = palette.black500;
/** Strong secondary: close and dismiss glyphs. */
export const ICON_STRONG = palette.grey600;
/** Secondary meta icons beside grey text. */
export const ICON_MUTED = palette.grey400;
/** Placeholders, unchecked boxes, and idle controls. */
export const ICON_SUBTLE = palette.grey200;
/** Row chevrons and other purely decorative affordances. */
export const ICON_FAINT = palette.grey100;
export const ICON_DANGER = palette.error600;
export const ICON_SUCCESS = palette.success700;
export const ICON_AMBER = palette.amber700;
/** On a blue header or a filled button. */
export const ICON_INVERSE = palette.surface;
