/** The surface a section sits on. The navbar takes the theme of the section behind it. */
export const NAV_THEMES = ["brand", "light", "dark"] as const;

export type NavTheme = (typeof NAV_THEMES)[number];

export type NavRouteConfig = {
  /** The theme the navbar is server-rendered in: the page's first section. */
  theme: NavTheme;
  /** Keep that theme for the whole page instead of following the sections. */
  locked?: boolean;
  /** "page" paints the light bar in the page's cream instead of its usual beige. */
  surface?: "page";
};

/** Pages whose navbar differs from the default (start on blue, follow the sections). */
const NAV_BY_ROUTE: Record<string, NavRouteConfig> = {
  "/for-owners": { theme: "light", locked: true, surface: "page" },
};

const DEFAULT_NAV: NavRouteConfig = { theme: "brand" };

export function navConfig(pathname: string): NavRouteConfig {
  return NAV_BY_ROUTE[pathname.replace(/\/$/, "") || "/"] ?? DEFAULT_NAV;
}
