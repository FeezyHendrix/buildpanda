import { Menu } from "@base-ui-components/react/menu";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  useActiveOrganizationId,
  useOrganizations,
  useSetActiveOrganization,
} from "@/hooks/use-organization";
import { useState, useEffect } from "react";

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = () => setMatches(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}

function ChevronDownIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m3 4.5 3 3 3-3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m2.5 7 3 3 6-6" />
    </svg>
  );
}

function OrgSwitcher() {
  const { data: organizations } = useOrganizations();
  const activeOrganizationId = useActiveOrganizationId();
  const setActive = useSetActiveOrganization();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const orgs = organizations ?? [];
  const activeOrg = orgs.find((org) => org.id === activeOrganizationId);

  if (orgs.length === 0) {
    return null;
  }

  function handleSelect(organizationId: string): void {
    if (organizationId === activeOrganizationId) return;
    setActive.mutate(organizationId);
  }

  return (
    <Menu.Root>
      <Menu.Trigger
        className={cn(
          "inline-flex max-w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-gray-700",
          "outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-gray-900/10",
        )}
        aria-label="Switch company"
      >
        <span className="truncate text-primary">
          {activeOrg?.name ?? "Select company"}
        </span>
        <ChevronDownIcon />
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner 
          side="bottom" 
          align={isDesktop ? "start" : "center"} 
          alignOffset={isDesktop ? 50 : 20} 
          sideOffset={isDesktop ? 30 : 8} 
          className="z-50 border border-muted rounded-xl"
        >
          <Menu.Popup
            className={cn(
              "min-w-[240px] rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-black/5 border border-muted",
              "origin-top-left outline-none",
            )}
          >
            <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Your companies
            </p>

            {orgs.map((org) => (
              <Menu.Item
                key={org.id}
                onClick={() => handleSelect(org.id)}
                className={cn(
                  "flex cursor-default select-none items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-gray-700",
                  "outline-none data-[highlighted]:bg-[#F6F6F6] data-[highlighted]:text-gray-900",
                )}
              >
                <span className="truncate">{org.name}</span>
                {org.id === activeOrganizationId && (
                  <span className="text-[#004DE7]">
                    <CheckIcon />
                  </span>
                )}
              </Menu.Item>
            ))}

          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

OrgSwitcher.displayName = "OrgSwitcher";

export { OrgSwitcher };
