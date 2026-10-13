import Link from "next/link";
import type { CSSProperties, KeyboardEvent } from "react";
import { ButtonLink } from "@/components/ui/button";
import { isNavMenu, navActions, navEntries, type NavLink, type NavMenu } from "@/content/nav";
import type { NavTheme } from "@/lib/themes";
import { DROPDOWN_PANEL_ID, MOBILE_PANEL_ID } from "./navbar-bar";

/** Place in the open sequence: rows come in one after another. */
const order = (index: number) => ({ "--i": index }) as CSSProperties;

type DropdownPanelProps = {
  menu: NavMenu;
  open: boolean;
  theme: NavTheme;
  /** Distance from the viewport's left edge to the trigger. */
  left: number;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onNavigate: () => void;
};

/** The desktop menu under a bar item. Rendered once, in the live layer's colours. */
export function DropdownPanel({ menu, open, theme, left, onKeyDown, onNavigate }: DropdownPanelProps) {
  return (
    <div
      id={DROPDOWN_PANEL_ID}
      data-theme={theme}
      data-open={open}
      inert={!open}
      style={{ left }}
      onKeyDown={onKeyDown}
      className="nav-theme nav-dropdown absolute top-full mt-2 hidden w-[16.5rem] -translate-x-5 border border-(--surface-outline) md:block"
    >
      <ul aria-label={menu.label}>
        {menu.items.map((item, index) => (
          <li key={item.id} style={order(index)} className="nav-dropdown-row border-(--surface-outline) not-first:border-t">
            <Link href={item.href} onClick={onNavigate} className="nav-dropdown-link">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

type MobilePanelProps = { open: boolean; theme: NavTheme; onNavigate: () => void };

/** On small screens the bar's menus are flattened into one list, with Home first. */
const mobileLinks: ReadonlyArray<NavLink> = [
  { id: "home", label: "Home", href: "/" },
  ...navEntries.flatMap((entry) => (isNavMenu(entry) ? entry.items : [entry])),
];

/**
 * The small-screen menu: one list of pages, then the two actions. It stays
 * mounted so it can animate both ways, and is inert while closed.
 */
export function MobilePanel({ open, theme, onNavigate }: MobilePanelProps) {
  return (
    <div
      id={MOBILE_PANEL_ID}
      data-theme={theme}
      data-open={open}
      inert={!open}
      className="nav-theme nav-mobile-panel absolute inset-x-0 top-full max-h-[calc(100svh-var(--nav-height))] overflow-y-auto md:hidden"
    >
      <nav aria-label="Menu" className="site-container">
        <div className="border-x border-(--surface-outline)">
          <ul>
            {mobileLinks.map((link, index) => (
              <li key={link.id} style={order(index)} className="nav-mobile-row border-b border-(--surface-outline)">
                <Link href={link.href} onClick={onNavigate} className="flex min-h-12 items-center px-4 text-base">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div style={order(mobileLinks.length)} className="nav-mobile-row flex flex-wrap gap-2 px-4 py-4">
            <ButtonLink variant="solid" href={navActions.demo.href} onClick={onNavigate}>
              {navActions.demo.label}
            </ButtonLink>
            <ButtonLink variant="outline" href={navActions.login.href} onClick={onNavigate}>
              {navActions.login.label}
            </ButtonLink>
          </div>
        </div>
      </nav>
    </div>
  );
}
