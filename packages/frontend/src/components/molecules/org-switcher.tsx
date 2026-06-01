import { Menu } from "@base-ui-components/react/menu";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  useActiveOrganizationId,
  useOrganizations,
  useSetActiveOrganization,
} from "@/hooks/use-organization";

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
          "inline-flex max-w-[200px] items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-gray-700",
          "outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-gray-900/10",
        )}
        aria-label="Switch company"
      >
        <span className="truncate">
          {activeOrg?.name ?? "Select company"}
        </span>
        <ChevronDownIcon />
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner align="start" sideOffset={8}>
          <Menu.Popup
            className={cn(
              "z-50 min-w-[240px] rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-black/5",
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

            <Menu.Separator className="my-1 h-px bg-gray-100" />

            <Menu.Item
              className={cn(
                "flex cursor-default select-none items-center rounded-lg px-3 py-2 text-sm text-gray-700",
                "outline-none data-[highlighted]:bg-[#F6F6F6] data-[highlighted]:text-gray-900",
              )}
              render={<Link to="/dashboard/settings/team" />}
            >
              Manage team & roles
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

OrgSwitcher.displayName = "OrgSwitcher";

export { OrgSwitcher };
