import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  useActiveOrganizationId,
  useCreateOrganization,
  useOrganizations,
  useSetActiveOrganization,
} from "@/hooks/use-organization";
import { INPUT_SM_CLASS } from "@/components/atoms/input";
import { Button } from "@/components/atoms/button";

interface WorkspaceSwitcherProps {
  className?: string;
}

function WorkspaceSwitcher({ className }: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const { data: organizations } = useOrganizations();
  const activeOrgId = useActiveOrganizationId();
  const setActive = useSetActiveOrganization();
  const createOrg = useCreateOrganization();

  const orgs = organizations ?? [];
  const activeOrg = orgs.find((o) => o.id === activeOrgId);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (orgs.length === 0) return null;

  const initials = (activeOrg?.name ?? "W").slice(0, 2).toUpperCase();

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-9 items-center gap-2 rounded-full bg-surface-alt pl-1.5 pr-3 text-sm outline-none transition-colors hover:bg-gray-100",
          open && "bg-gray-100",
        )}
        aria-label="Switch workspace"
        aria-expanded={open}
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-600 text-[10px] font-semibold text-white">
          {initials}
        </span>
        <span className="hidden max-w-[150px] truncate font-medium text-gray-800 sm:block">
          {activeOrg?.name ?? "Select workspace"}
        </span>
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
          className={cn("shrink-0 text-gray-500 transition-transform", open && "rotate-180")}
        >
          <path d="m3 4.5 3 3 3-3" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[264px] rounded-lg border border-line-hair bg-white p-2 shadow-lg">
          <p className="px-2 pb-1.5 pt-1 text-xs font-medium uppercase text-ink-muted">
            Your workspaces
          </p>
          <div className="max-h-72 space-y-0.5 overflow-y-auto">
            {orgs.map((org) => {
              const isActive = org.id === activeOrgId;
              return (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => {
                    if (!isActive) setActive.mutate(org.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm outline-none transition-colors",
                    isActive ? "bg-surface-alt text-gray-900" : "text-gray-700 hover:bg-surface-alt",
                  )}
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-600 text-[10px] font-semibold text-white">
                    {org.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="flex-1 truncate text-left font-medium">{org.name}</span>
                  {isActive && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#004DE7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const name = newOrgName.trim();
              if (!name) return;
              createOrg.mutate(
                { name },
                {
                  onSuccess: () => {
                    setNewOrgName("");
                    setOpen(false);
                  },
                },
              );
            }}
            className="mt-1.5 border-t border-line-hair px-1 pb-1 pt-2.5"
          >
            <p className="mb-1.5 text-xs font-medium uppercase text-ink-muted">
              New workspace
            </p>
            <div className="flex gap-1.5">
              <input
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="Workspace name"
                className={cn(INPUT_SM_CLASS, "min-w-0 flex-1")}
              />
              <Button type="submit" size="md" disabled={!newOrgName.trim()} loading={createOrg.isPending}>
                Create
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

WorkspaceSwitcher.displayName = "WorkspaceSwitcher";

export { WorkspaceSwitcher };
