import type { ReactNode } from "react";
import { Navigate, useParams } from "react-router-dom";
import { authClient } from "@/lib/auth-client";
import { useFeatureFlag } from "@/hooks/use-feature-flags";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import { useOrgPermissions } from "@/hooks/use-organization";
import { useProjectAccess } from "@/hooks/use-participants";
import { canViewResource } from "@/lib/project-types";
import { DataCommitmentGate } from "@/components/molecules/data-commitment-gate";

/**
 * Route guards for the owner/company split.
 *
 * `accountType` chooses what a user *sees* (which home, which workspace);
 * the backend's org-membership / project-participant checks decide what they
 * can *do*. These guards are presentation-level only — owners are routed to
 * their portal, company staff to the workspace — and must never be the sole
 * authorization mechanism.
 */

type SessionUser = { accountType?: string | null; id?: string | null };

// ─── Onboarding completion (temporary localStorage strategy) ───────────────────
//
// This is a stopgap until the backend exposes an `isOnboarded` field on the
// user record. See docs/onboarding-backend-migration.md for the migration plan.
//
// Key is scoped to the userId so multiple users on the same device are isolated.
const ONBOARDING_KEY = (userId: string) =>
  `buildpanda:onboarding-complete:${userId}`;

/**
 * Returns true when the user has completed onboarding.
 * Swap the body of this function for a backend-derived flag when the field is ready.
 */
export function isOnboardingComplete(userId: string | null | undefined): boolean {
  if (!userId) return false;
  try {
    return localStorage.getItem(ONBOARDING_KEY(userId)) === "true";
  } catch {
    return false;
  }
}

/**
 * Marks the current user's onboarding as complete in localStorage.
 * Call this at the end of the onboarding flow before navigating to the app.
 */
export function markOnboardingComplete(userId: string): void {
  try {
    localStorage.setItem(ONBOARDING_KEY(userId), "true");
  } catch {
    // localStorage unavailable (private mode / quota) — silently ignore
  }
}

function useGuardSession() {
  const { data, isPending } = authClient.useSession();
  const user = data?.user as SessionUser | undefined;
  return {
    isPending,
    signedIn: Boolean(user),
    accountType: user?.accountType ?? null,
    userId: user?.id ?? null,
  };
}

const LAST_SUITE_KEY = "buildpanda:last-suite";
export const PENDING_PROJECT_INVITE_KEY = "buildpanda:pending-project-invite";
export const PENDING_ORG_INVITE_KEY = "buildpanda:pending-org-invite";

/**
 * Returns the correct home path for a user after sign-in.
 * @param accountType - value from the session user
 * @param userId - used to check the localStorage onboarding flag
 */
export function homePathFor(
  accountType: string | null | undefined,
  userId?: string | null,
): string {
  if (accountType === "project_owner") return "/my-build";
  // Send company users through onboarding on first login
  if (!isOnboardingComplete(userId)) return "/onboarding";
  // Company users return to whichever suite they were last in
  const lastSuite = localStorage.getItem(LAST_SUITE_KEY);
  return lastSuite === "sales" ? "/sales" : "/dashboard";
}

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA]">
      <p className="text-sm text-gray-500">Loading…</p>
    </div>
  );
}

/** Any signed-in user (owners may be participants, staff may own builds). */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isPending, signedIn } = useGuardSession();
  if (isPending) return <FullScreenLoader />;
  if (!signedIn) return <Navigate to="/auth/sign-in" replace />;
  return (
    <>
      {children}
      <DataCommitmentGate />
    </>
  );
}

/**
 * Gate for the /onboarding route:
 * - Not signed in → sign-in page
 * - Already onboarded → home (skip re-entry)
 * - Otherwise → render the onboarding layout
 */
export function RequireOnboarding({ children }: { children: ReactNode }) {
  const { isPending, signedIn, accountType } = useGuardSession();
  const { data } = authClient.useSession();
  const userId = (data?.user as SessionUser | undefined)?.id ?? null;

  if (isPending) return <FullScreenLoader />;
  if (!signedIn) return <Navigate to="/auth/sign-in" replace />;
  if (isOnboardingComplete(userId)) {
    return <Navigate to={homePathFor(accountType, userId)} replace />;
  }
  return <>{children}</>;
}

/** Company-only routes (dashboard, project creation). Owners → their portal. */
export function RequireCompany({ children }: { children: ReactNode }) {
  const { isPending, signedIn, accountType } = useGuardSession();
  if (isPending) return <FullScreenLoader />;
  if (!signedIn) return <Navigate to="/auth/sign-in" replace />;
  if (accountType === "project_owner") {
    return <Navigate to="/my-build" replace />;
  }
  return <>{children}</>;
}

/** Redirects to project overview if the given feature flag is disabled. */
export function ProjectFeatureFlagGate({ flag, children }: { flag: FeatureFlagKey; children: ReactNode }) {
  const { projectId } = useParams<{ projectId: string }>();
  const enabled = useFeatureFlag(flag);
  if (!enabled) return <Navigate to={`/project/${projectId}/overview`} replace />;
  return <>{children}</>;
}

/**
 * Redirects to project overview when the caller's role lacks `<resource>:view`.
 * Presentation-level only — the backend enforces the same permission on the API.
 */
export function ProjectPermissionGate({
  resource,
  children,
}: {
  resource: string;
  children: ReactNode;
}) {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: access, isPending } = useProjectAccess(projectId);
  if (isPending) return <FullScreenLoader />;
  if (!canViewResource(access, resource)) {
    return <Navigate to={`/project/${projectId}/overview`} replace />;
  }
  return <>{children}</>;
}

/** Redirects to /dashboard when the caller lacks `<resource>:<action>` in their
 *  active org. Presentation-level only — the backend enforces the same. */
export function OrgPermissionGate({
  resource,
  action,
  children,
}: {
  resource: string;
  action: string;
  children: ReactNode;
}) {
  const { data, isPending } = useOrgPermissions();
  if (isPending) return <FullScreenLoader />;
  const allowed = (data?.permissions?.[resource] ?? []).includes(action);
  if (!allowed) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** Redirects to /sales if the given feature flag is disabled. */
export function SalesFeatureFlagGate({ flag, children }: { flag: FeatureFlagKey; children: ReactNode }) {
  const enabled = useFeatureFlag(flag);
  if (!enabled) return <Navigate to="/sales" replace />;
  return <>{children}</>;
}

/** Root landing: sends each account type to its home. */
export function HomeRedirect() {
  const { isPending, signedIn, accountType, userId } = useGuardSession();
  if (isPending) return <FullScreenLoader />;
  if (!signedIn) return <Navigate to="/auth/sign-in" replace />;
  const pendingProjectInvite = localStorage.getItem(PENDING_PROJECT_INVITE_KEY);
  if (pendingProjectInvite) {
    return <Navigate to={`/accept-project-invite/${pendingProjectInvite}`} replace />;
  }
  const pendingOrgInvite = localStorage.getItem(PENDING_ORG_INVITE_KEY);
  if (pendingOrgInvite) {
    return <Navigate to={`/accept-invitation/${pendingOrgInvite}`} replace />;
  }
  return <Navigate to={homePathFor(accountType, userId)} replace />;
}
