/**
 * Palette values for the places `className` cannot reach: Ionicon `color=`
 * props, react-navigation options, canvas/DOM CSS strings.
 *
 * Every value here is a token in tailwind.config.js, named after it — never a
 * near-miss shade. `colors.test.ts` fails the moment the two drift. The config
 * is not imported at runtime because it pulls the NativeWind preset into the
 * app bundle.
 */
export const palette = {
  primary500: "#004DE7",
  surface: "#FFFFFF",
  surfaceAlt: "#F6F6F6",
  canvas: "#FAFAFA",
  hairline: "#F0F0F0",
  success500: "#1AE592",
  success600: "#18D085",
  success700: "#13A368",
  error500: "#E9301C",
  error600: "#D42C19",
  warning600: "#B6E800",
  amber700: "#8E6B00",
  grey50: "#EDEDED",
  grey100: "#C8C8C8",
  grey200: "#ADADAD",
  grey300: "#888888",
  grey400: "#717171",
  grey600: "#464646",
  black500: "#1A1A1A",
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
