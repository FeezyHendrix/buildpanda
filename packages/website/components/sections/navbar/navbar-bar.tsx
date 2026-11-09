import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { ChevronDownIcon } from "@/components/ui/icons";
import { isNavMenu, navActions, navEntries } from "@/content/nav";

export const DROPDOWN_PANEL_ID = "nav-dropdown";
export const MOBILE_PANEL_ID = "nav-mobile";

type NavbarBarProps = {
  /** Only the live layer is reachable by keyboard and assistive technology. */
  live: boolean;
  openMenuId: string | null;
  mobileOpen: boolean;
  onToggleMenu: (id: string) => void;
  onToggleMobile: () => void;
};

/**
 * One themed copy of the bar. All colours come from the layer's `--nav-*`
 * variables, so the three copies are the same markup. `data-nav-item` names
 * each control so focus can move to its twin when the live layer changes.
 */
export function NavbarBar({ live, openMenuId, mobileOpen, onToggleMenu, onToggleMobile }: NavbarBarProps) {
  const tabIndex = live ? undefined : -1;

  return (
    <nav
      aria-label="Main"
      className="site-container flex h-full items-center justify-between gap-4 md:grid md:grid-cols-[1fr_auto_1fr]"
    >
      <Link
        href="/"
        data-nav-item="home"
        tabIndex={tabIndex}
        className="inline-flex h-11 items-center justify-self-start text-(--surface-logo)"
      >
        <Logo className="h-8 w-auto md:h-[2.125rem]" />
      </Link>

      <ul className="hidden items-center gap-8 md:flex">
        {navEntries.map((entry) => (
          <li key={entry.id}>
            {isNavMenu(entry) ? (
              <button
                type="button"
                data-nav-item={entry.id}
                tabIndex={tabIndex}
                aria-expanded={openMenuId === entry.id}
                aria-controls={DROPDOWN_PANEL_ID}
                onClick={() => onToggleMenu(entry.id)}
                className="nav-link"
              >
                {entry.label}
                <ChevronDownIcon className="nav-chevron" />
              </button>
            ) : (
              <Link href={entry.href} data-nav-item={entry.id} tabIndex={tabIndex} className="nav-link">
                {entry.label}
              </Link>
            )}
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2 justify-self-end">
        <ButtonLink
          variant="outline"
          href={navActions.login.href}
          data-nav-item={navActions.login.id}
          tabIndex={tabIndex}
          className="hidden md:inline-flex"
        >
          {navActions.login.label}
        </ButtonLink>
        <ButtonLink
          variant="solid"
          href={navActions.demo.href}
          data-nav-item={navActions.demo.id}
          tabIndex={tabIndex}
          className="hidden md:inline-flex"
        >
          {navActions.demo.label}
        </ButtonLink>
        <button
          type="button"
          data-nav-item="mobile-menu"
          tabIndex={tabIndex}
          aria-expanded={mobileOpen}
          aria-controls={MOBILE_PANEL_ID}
          onClick={onToggleMobile}
          aria-label={mobileOpen ? "Close menu" : "Menu"}
          className="-mr-2.5 flex size-11 items-center justify-center md:hidden"
        >
          {/* Two lines that cross into an X while the menu is open (see `.menu-icon`). */}
          <span aria-hidden="true" className="menu-icon">
            <span />
            <span />
          </span>
        </button>
      </div>
    </nav>
  );
}
