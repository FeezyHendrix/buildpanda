import { site } from "./site";

export type NavLink = { id: string; label: string; href: string };
export type NavMenu = { id: string; label: string; items: ReadonlyArray<NavLink> };
export type NavEntry = NavLink | NavMenu;

export function isNavMenu(entry: NavEntry): entry is NavMenu {
  return "items" in entry;
}

export const navEntries: ReadonlyArray<NavEntry> = [
  {
    id: "construction",
    label: "Construction",
    // PLACEHOLDER target: the /for-contractors page does not exist in this app yet.
    items: [
      { id: "for-contractors", label: "For Contractors", href: "/for-contractors" },
      { id: "for-owners", label: "For Owners", href: "/for-owners" },
    ],
  },
  { id: "about", label: "About Us", href: "/about" },
];

export const navActions = {
  login: { id: "login", label: "Login", href: site.appUrl },
  // PLACEHOLDER target: the demo-booking destination is not decided.
  demo: { id: "demo", label: "Book a Demo", href: "#book-a-demo" },
} as const satisfies Record<string, NavLink>;
