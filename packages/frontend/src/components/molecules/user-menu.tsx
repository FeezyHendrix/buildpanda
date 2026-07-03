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
import { icons } from "@/assets/icons/icons";

interface UserMenuProps {
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
  onLogout: () => void;
  className?: string;
  /** "compact" = navbar pill trigger. "full" = sidebar footer trigger (opens upward). */
  variant?: "compact" | "full";
}

type Step = "main" | "org-switcher";

function IconBox({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
      {children}
    </span>
  );
}

function Row({
  icon,
  label,
  trailing,
  onClick,
  danger,
  asLink,
}: {
  icon: React.ReactNode;
  label: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  asLink?: string;
}) {
  const cls = cn(
    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none transition-colors hover:bg-[#F6F6F6]",
    danger ? "text-red-600 hover:bg-red-50" : "text-gray-700",
  );
  if (asLink) {
    return (
      <Link to={asLink} className={cls} onClick={onClick}>
        <IconBox>{icon}</IconBox>
        <span className="flex-1">{label}</span>
        {trailing}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick}>
      <IconBox>{icon}</IconBox>
      <span className="flex-1 text-left">{label}</span>
      {trailing}
    </button>
  );
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
  const [step, setStep] = useState<Step>("main");
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
        setStep("main");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function close() {
    setOpen(false);
    setStep("main");
  }

  const isFull = variant === "full";

  const trigger = isFull ? (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left outline-none hover:bg-[#EFEFEF]",
        className,
      )}
      aria-label="Open user menu"
      aria-expanded={open}
    >
      <Avatar name={name} src={avatarUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{name}</p>
        {email && <p className="truncate text-xs text-gray-500">{email}</p>}
      </div>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 4.5 3 3 3-3"/></svg>
    </button>
  ) : (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full outline-none",
        className,
      )}
      aria-label="Open user menu"
      aria-expanded={open}
    >
      <Avatar name={name} src={avatarUrl} size="sm" />
      <span className="hidden max-w-[160px] truncate text-sm font-medium text-gray-700 lg:block">
        {activeOrg?.name ?? name}
      </span>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-gray-500"><path d="m3 4.5 3 3 3-3"/></svg>
    </button>
  );

  const popupCls = cn(
    "absolute z-50 min-w-[240px] rounded-xl border border-[#F0F0F0] bg-white p-1.5 shadow-lg",
    isFull ? "bottom-full left-0 mb-2" : "right-0 top-full mt-2",
  );

  const mainStep = (
    <>
      <p className="px-3 pb-1 pt-2 text-xs font-medium text-gray-400">
        Current workspace
      </p>
      <div className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-900">
        <IconBox>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
        </IconBox>
        <span className="flex-1 truncate">{activeOrg?.name ?? "—"}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#004DE7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
      </div>

      <div className="my-1 h-px bg-gray-100" />

      <Row
        icon={<ReactSVG src={icons.teams} />}
        label="Manage team roles"
        asLink="/dashboard/settings/team"
        onClick={close}
      />
      <Row
        icon={<ReactSVG src={icons.switchProfile} />}
        label="Switch profile"
        onClick={() => setStep("org-switcher")}
        trailing={<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-gray-400"><path d="m4.5 3 3 3-3 3"/></svg>}
      />

      <div className="my-1 h-px bg-gray-100" />

      <Row
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>}
        label="Log out"
        danger
        onClick={() => { close(); onLogout(); }}
      />
    </>
  );

  const orgSwitcherStep = (
    <>
      <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
        <button
          type="button"
          onClick={() => setStep("main")}
          className="flex size-6 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
          aria-label="Back"
        >
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m7.5 9-3-3 3-3"/></svg>
        </button>
        <p className="text-sm font-medium text-gray-700">Switch profile</p>
      </div>

      <p className="px-3 pb-1 pt-2 text-xs font-medium text-gray-400">Your workspaces</p>

      {orgs.map((org) => (
        <button
          key={org.id}
          type="button"
          onClick={() => {
            if (org.id !== activeOrgId) setActive.mutate(org.id);
            close();
          }}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none hover:bg-[#F6F6F6]"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[10px] font-semibold text-primary-600">
            {org.name.slice(0, 2).toUpperCase()}
          </span>
          <span className="flex-1 truncate text-left">{org.name}</span>
          {org.id === activeOrgId && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#004DE7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
          )}
        </button>
      ))}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const n = newOrgName.trim();
          if (!n) return;
          createOrg.mutate({ name: n }, { onSuccess: () => setNewOrgName("") });
        }}
        className="mt-1 border-t border-gray-100 px-3 py-2"
      >
        <p className="mb-1 text-xs font-medium text-gray-400">New workspace</p>
        <div className="flex gap-1.5">
          <input
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            placeholder="Workspace name"
            className="h-8 min-w-0 flex-1 rounded-lg bg-[#F6F6F6] px-2 text-xs text-gray-900 outline-none"
          />
          <button
            type="submit"
            disabled={!newOrgName.trim() || createOrg.isPending}
            className="rounded-lg bg-primary px-2.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            Add
          </button>
        </div>
        {createOrg.error && (
          <p className="mt-1 text-xs text-red-600">{(createOrg.error as Error).message}</p>
        )}
      </form>
    </>
  );

  return (
    <div ref={ref} className="relative">
      {trigger}
      {open && (
        <div className={popupCls}>
          {step === "main" ? mainStep : orgSwitcherStep}
        </div>
      )}
    </div>
  );
}

UserMenu.displayName = "UserMenu";

export { UserMenu, type UserMenuProps };
