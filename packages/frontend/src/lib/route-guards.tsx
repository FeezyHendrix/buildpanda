import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { authClient } from "@/lib/auth-client";

/**
 * Route guards for the owner/company split.
 *
 * `accountType` chooses what a user *sees* (which home, which workspace);
 * the backend's org-membership / project-participant checks decide what they
 * can *do*. These guards are presentation-level only — owners are routed to
 * their portal, company staff to the workspace — and must never be the sole
 * authorization mechanism.
 */

type SessionUser = { accountType?: string | null };

function useGuardSession() {
  const { data, isPending } = authClient.useSession();
  const accountType =
    (data?.user as SessionUser | undefined)?.accountType ?? null;
  return { isPending, signedIn: Boolean(data?.user), accountType };
}

const LAST_SUITE_KEY = "buildpanda:last-suite";

export function homePathFor(accountType: string | null | undefined): string {
  if (accountType === "project_owner") return "/my-build";
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

/** Root landing: sends each account type to its home. */
export function HomeRedirect() {
  const { isPending, signedIn, accountType } = useGuardSession();
  if (isPending) return <FullScreenLoader />;
  if (!signedIn) return <Navigate to="/auth/sign-in" replace />;
  return <Navigate to={homePathFor(accountType)} replace />;
}
