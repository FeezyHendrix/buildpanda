import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "@/components/atoms/avatar";
import { cn } from "@/lib/utils";
import {
  useActiveOrganizationId,
  useCreateOrganization,
  useOrganizations,
  useSetActiveOrganization,
} from "@/hooks/use-organization";
import { ReactSVG } from "react-svg";
import { Button } from "../atoms";
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { icons2 } from "@/assets/icons2/icon2";
import { getInitials } from "@/lib/formatters";

interface UserMenuProps {
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
  onLogout: () => void;
  className?: string;
  /** "compact" = navbar pill trigger. "full" = sidebar footer trigger (opens upward). */
  variant?: "compact" | "full";
}

function UserMenu({
  name,
  email,
  avatarUrl,
  onLogout,
  className,
  variant = "compact",
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: organizations } = useOrganizations();
  const activeOrgId = useActiveOrganizationId();
  const setActive = useSetActiveOrganization();
  const createOrg = useCreateOrganization();
  const [newOrgName, setNewOrgName] = useState("");

  const orgs = organizations ?? [];
  const activeOrg = orgs.find((o) => o.id === activeOrgId);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function close() {
    setOpen(false);
  }

  const isFull = variant === "full";

  const trigger = isFull ? (
    <Button
      type="button"
      variant='outline'
      onClick={() => setOpen((v) => !v)}
      className={cn(
        "flex w-full curor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-left outline-none hover:bg-[#EFEFEF]",
        className,
      )}
      aria-label="Open user menu"
      aria-expanded={open}
    >
      <Avatar name={name} src={avatarUrl} size="sm" className="!rounded-none" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{name}</p>
        {email && <p className="truncate text-xs text-gray-500">{email}</p>}
      </div>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 4.5 3 3 3-3"/></svg>
    </Button>
  ) : (
    <Button
      type="button"
      variant="outline"
      onClick={() => setOpen((v) => !v)}
      className={cn(
        "flex h-9 items-stretch p-0 gap-0 outline-none cursor-pointer",
        className,
      )}
      aria-label="Open user menu"
      aria-expanded={open}
    >
      <Avatar
        name={activeOrg?.name ?? name}
        src={avatarUrl}
        size="sm"
        className="!rounded-none !h-full !w-9 border-r border-[#EBEBEB] shrink-0"
      />
      <div className="flex items-center gap-1.5 px-3">
        <span className="hidden max-w-[160px] truncate text-caption-l font-medium text-[#1E1E1E] lg:block">
          {activeOrg?.name ?? name}
        </span>
        {open ? <ChevronUp className='size-4 stroke-[#0D112666]' /> : <ChevronDown className='size-4 stroke-[#0D112666]' />}
      </div>
    </Button>
  );

  const popupCls = cn(
    "absolute z-50 w-[303px] bg-white p-4 border border-[#DDDDDD] shadow-lg flex flex-col gap-4",
    isFull ? "bottom-full left-0 mb-2" : "right-0 top-full mt-2",
  );

  return (
    <div ref={ref} className="relative">
      {trigger}
      {open && (
        <div className={popupCls}>
          {/* Workspaces Section */}
          <div className="flex flex-col gap-2">
            <span className="text-caption-s font-bold text-grey-450 uppercase tracking-[20%]">
              Workspaces
            </span>
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
              {orgs.map((org) => {
                const isActive = org.id === activeOrgId;
                return (
                  <button
                    key={org.id}
                    type="button"
                    onClick={() => {
                      if (!isActive) setActive.mutate(org.id);
                      close();
                    }}
                    className={cn(
                      "flex h-11 items-stretch p-0 gap-0 outline-none border border-transparent w-full text-left cursor-pointer",
                      isActive ? "bg-grey-50" : "hover:bg-grey-50/50"
                    )}
                  >
                    <div className="flex w-11 shrink-0 items-center justify-center bg-primary-50 text-[13px] font-semibold text-primary select-none border-r border-[#EBEBEB]">
                      {getInitials(org.name)}
                    </div>
                    <div className="flex flex-1 items-center justify-between px-3 min-w-0">
                      <span className="truncate text-caption-l font-medium text-black-500">
                        {org.name}
                      </span>
                      {isActive && (
                        <ReactSVG src={icons2.check} className="size-4" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-[#EBEBEB]" />

          {/* New Workspace Section */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const n = newOrgName.trim();
              if (!n) return;
              createOrg.mutate({ name: n }, { onSuccess: () => setNewOrgName("") });
            }}
            className="flex flex-col gap-2"
          >
            <span className="text-caption-s font-bold text-grey-450 uppercase tracking-[20%]">
              New Workspace
            </span>
            <div className="flex gap-2.5">
              <input
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="Workspace name"
                className="h-10 min-w-0 flex-1 border border-[#EBEBEB] bg-white px-3 text-sm text-[#1E1E1E] placeholder:text-[#B0B0B0] outline-none"
              />
              <button
                type="submit"
                disabled={!newOrgName.trim() || createOrg.isPending}
                className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#004DE7] text-white hover:bg-[#053DAB] disabled:opacity-50 cursor-pointer"
              >
                <Plus className="size-4 stroke-[3px]" />
              </button>
            </div>
            {createOrg.error && (
              <p className="text-xs text-red-600">{(createOrg.error as Error).message}</p>
            )}
          </form>

          {/* Footer Actions */}
          <div className="flex gap-2.5">
            <Link
              to="/dashboard/settings"
              onClick={close}
              className="flex h-10 flex-1 items-center justify-center gap-2 border border-border bg-white text-sm font-medium text-black-500 hover:bg-grey-50 outline-none cursor-pointer"
            >
              <ReactSVG src={icons2.settings} className="size-4" />
              Settings
            </Link>
            <Button
              type="button"
              variant="danger-outline"
              onClick={() => {
                close();
                onLogout();
              }}
              className="flex h-10 flex-1 items-center justify-center gap-2 text-sm font-medium cursor-pointer"
            >
              <ReactSVG src={icons2.logout} className="size-4" />
              Logout
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

UserMenu.displayName = "UserMenu";

export { UserMenu, type UserMenuProps };
