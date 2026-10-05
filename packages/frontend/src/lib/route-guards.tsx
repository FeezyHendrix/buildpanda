import type { ReactNode } from "react";
import { Navigate, useParams } from "react-router-dom";
import { authClient } from "@/lib/auth-client";
import { useFeatureFlag } from "@/hooks/use-feature-flags";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import { useActiveOrganizationId, useOrgPermissions } from "@/hooks/use-organization";
import { useProjectAccess } from "@/hooks/use-participants";
import { canViewResource } from "@/lib/project-types";
import { DataCommitmentGate } from "@/components/molecules/data-commitment-gate";
import { useOnboardingStatus } from "@/hooks/use-onboarding";
import { onboardingApi, type OnboardingStatus } from "@/api/onboarding";

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

// ─── Onboarding completion ────────────────────────────────────────────────────
//
// `organization.onboarding_completed_at` is the single source of truth, read via
// GET /v2/onboarding/status. Onboarding is a property of the WORKSPACE, not the
// person, so an employee invited into an already-onboarded org is never asked to
// re-enter their employer's details.

/**
 * The wizard is required only when the server says so AND the caller could
 * actually submit it. Anything else — loading, errored, disabled, or a role
 * without `organization:update` — is false on purpose: bouncing a user into a
 * wizard whose POST would also fail strands them with no way into the app.
 */
function wizardRequired(status: OnboardingStatus | null | undefined): boolean {
  return Boolean(status && !status.completed && status.canComplete);
}

export function needsOnboarding(
  accountType: string | null | undefined,
  query: ReturnType<typeof useOnboardingStatus>,
): boolean {
  if (accountType === "project_owner") return false;
  if (!query.isSuccess) return false;
  return wizardRequired(query.data);
}

type OnboardingGate = "loading" | "skip" | "required";

/**
 * The one place that decides whether a signed-in user must finish the wizard.
 * Every guard reads this rather than re-deriving it, so they cannot disagree
 * with each other and the ordering below cannot be reintroduced wrongly.
 */
function useOnboardingGate(accountType: string | null | undefined): OnboardingGate {
  const orgId = useActiveOrganizationId();
  const query = useOnboardingStatus();
  if (accountType === "project_owner") return "skip";
  // No active organization means the query is disabled, and a disabled React
  // Query reports `isPending` forever — waiting on it would strand the user on
  // a loader with nothing to resolve it. Let them through instead.
  if (!orgId) return "skip";
  if (query.isPending) return "loading";
  return needsOnboarding(accountType, query) ? "required" : "skip";
}

/**
 * Pre-navigation equivalent of `needsOnboarding` for the auth pages, which decide
 * where to go inside a submit handler before any guard mounts. Shares
 * `wizardRequired`, so sign-in and the destination guard cannot disagree.
 */
export async function resolveHomePath(
  accountType: string | null | undefined,
): Promise<string> {
  if (accountType === "project_owner") return "/my-build";
  const status = await onboardingApi.status().catch(() => null);
  return homePathFor(accountType, wizardRequired(status));
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

/** Returns the correct home path for a user after sign-in. */
export function homePathFor(
  accountType: string | null | undefined,
  needsWizard: boolean,
): string {
  if (accountType === "project_owner") return "/my-build";
  if (needsWizard) return "/onboarding";
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
  const { isPending, signedIn, accountType } = useGuardSession();
  const gate = useOnboardingGate(accountType);
  if (isPending) return <FullScreenLoader />;
  // Must precede the gate: it depends on an org id that only exists once the
  // session has resolved, and a signed-out visitor has none.
  if (!signedIn) return <Navigate to="/auth/sign-in" replace />;
  if (gate === "loading") return <FullScreenLoader />;
  // The wizard names the company that brands every proposal and document, so an
  // un-onboarded workspace cannot use the app. The invite-acceptance routes are
  // deliberately NOT behind this guard, so an invitee can still join an org.
  if (gate === "required") return <Navigate to="/onboarding" replace />;
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
  const gate = useOnboardingGate(accountType);

  if (isPending) return <FullScreenLoader />;
  if (!signedIn) return <Navigate to="/auth/sign-in" replace />;
  if (gate === "loading") return <FullScreenLoader />;
  if (gate !== "required") {
    // `false` is hardcoded so this exit can never point back at /onboarding.
    return <Navigate to={homePathFor(accountType, false)} replace />;
  }
  return <>{children}</>;
}

/** Company-only routes (dashboard, project creation). Owners → their portal. */
export function RequireCompany({ children }: { children: ReactNode }) {
  const { isPending, signedIn, accountType } = useGuardSession();
  const gate = useOnboardingGate(accountType);
  if (isPending) return <FullScreenLoader />;
  if (!signedIn) return <Navigate to="/auth/sign-in" replace />;
  if (accountType === "project_owner") {
    return <Navigate to="/my-build" replace />;
  }
  if (gate === "loading") return <FullScreenLoader />;
  if (gate === "required") return <Navigate to="/onboarding" replace />;
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
  const { isPending, signedIn, accountType } = useGuardSession();
  const gate = useOnboardingGate(accountType);
  if (isPending) return <FullScreenLoader />;
  if (!signedIn) return <Navigate to="/auth/sign-in" replace />;
  // Pending invites win, and are answered before waiting on any query: accepting
  // an invite is what gives the user the org the status call needs.
  const pendingProjectInvite = localStorage.getItem(PENDING_PROJECT_INVITE_KEY);
  if (pendingProjectInvite) {
    return <Navigate to={`/accept-project-invite/${pendingProjectInvite}`} replace />;
  }
  const pendingOrgInvite = localStorage.getItem(PENDING_ORG_INVITE_KEY);
  if (pendingOrgInvite) {
    return <Navigate to={`/accept-invitation/${pendingOrgInvite}`} replace />;
  }
  if (gate === "loading") return <FullScreenLoader />;
  return <Navigate to={homePathFor(accountType, gate === "required")} replace />;
}
