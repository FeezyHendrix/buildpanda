import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "@/components/atoms/avatar";
import { cn } from "@/lib/utils";
import {
  useActiveOrganizationId,
  useCreateOrganization,
  useHasOrgPermission,
  useOrganizations,
  useSetActiveOrganization,
} from "@/hooks/use-organization";
import { ReactSVG } from "react-svg";
import { icons } from "@/assets/icons/icons";
import { INPUT_SM_CLASS } from "@/components/atoms/input";
import { Button } from "@/components/atoms/button";

interface UserMenuProps {
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
  onLogout: () => void;
  className?: string;
  /** "compact" = app-bar trigger. "full" = dark sidebar footer (opens upward). "rail" = avatar only in the collapsed rail. */
  variant?: "compact" | "full" | "rail";
}

type Step = "main" | "org-switcher";

function IconBox({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-gray-100 text-ink-muted">
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
    "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm outline-none transition-colors hover:bg-black/5",
    danger ? "text-negative-600" : "text-ink",
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
  const canManageTeam = useHasOrgPermission("teamMembers", "manage");
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

  const isFull = variant === "full" || variant === "rail";

  const trigger = variant === "rail" ? (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className={cn("flex w-full items-center justify-center rounded-lg py-2 outline-none hover:bg-white/10", className)}
      aria-label="Open user menu"
      aria-expanded={open}
      title={name}
    >
      <Avatar name={name} src={avatarUrl} size="sm" />
    </button>
  ) : isFull ? (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left outline-none transition-colors hover:bg-white/10",
        className,
      )}
      aria-label="Open user menu"
      aria-expanded={open}
    >
      <Avatar name={name} src={avatarUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-inverted">{name}</p>
        {email && <p className="truncate text-sm text-ink-muted">{email}</p>}
      </div>
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4 text-ink-disabled"><path d="m5 6 3-3 3 3M5 10l3 3 3-3"/></svg>
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
      <span className="hidden max-w-[160px] truncate text-sm font-medium text-ink lg:block">
        {activeOrg?.name ?? name}
      </span>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-ink-muted"><path d="m3 4.5 3 3 3-3"/></svg>
    </button>
  );

  const popupCls = cn(
    "absolute z-50 min-w-[240px] rounded-lg border border-line bg-white p-1.5 shadow-card",
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
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-500)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
      </div>

      <div className="my-1 h-px bg-gray-100" />

      {canManageTeam && (
        <Row
          icon={<ReactSVG src={icons.teams} />}
          label="Manage team & roles"
          asLink="/dashboard/settings?tab=members"
          onClick={close}
        />
      )}
      <Row
        icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>}
        label="Settings"
        asLink="/dashboard/settings"
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
      <div className="flex items-center gap-2 border-b border-line-hair px-3 py-2">
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
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none hover:bg-surface-alt"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[10px] font-semibold text-primary-600">
            {org.name.slice(0, 2).toUpperCase()}
          </span>
          <span className="flex-1 truncate text-left">{org.name}</span>
          {org.id === activeOrgId && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-500)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
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
        className="mt-1 border-t border-line-hair px-3 py-2"
      >
        <p className="mb-1 text-xs font-medium text-gray-400">New workspace</p>
        <div className="flex gap-1.5">
          <input
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            placeholder="Workspace name"
            className={cn(INPUT_SM_CLASS, "min-w-0 flex-1")}
          />
          <Button type="submit" size="sm" disabled={!newOrgName.trim()} loading={createOrg.isPending}>
            Add
          </Button>
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
