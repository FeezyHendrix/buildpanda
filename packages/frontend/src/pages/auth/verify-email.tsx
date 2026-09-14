import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { isInvalidRecoveryLink } from "@/api/auth-recovery";
import { useEmailVerification } from "@/hooks/use-auth-recovery";
import { clearAuthRecovery, readAuthRecovery } from "@/lib/auth-recovery";
import { safeReturnPath, signInPath } from "@/lib/return-path";
import { PENDING_ORG_INVITE_KEY, PENDING_PROJECT_INVITE_KEY, homePathFor } from "@/lib/route-guards";
import { VerificationEmailForm } from "./verification-email-form";

function verificationDestination(target: string | null) {
  // Organization invitations are accepted by the verification endpoint.
  if (target?.startsWith("/accept-invitation/")) return "/";
  if (target) return target;
  try {
    const projectInvite = localStorage.getItem(PENDING_PROJECT_INVITE_KEY);
    return projectInvite ? `/accept-project-invite/${encodeURIComponent(projectInvite)}` : "/";
  } catch { return "/"; }
}

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { email?: string; redirectTo?: string | null } | null;
  const [saved] = useState(() => readAuthRecovery("verification"));
  const email = state?.email ?? saved?.email ?? "";
  const redirectTo = safeReturnPath(params.get("redirect")) ?? safeReturnPath(state?.redirectTo) ?? saved?.redirectTo ?? null;
  const [fallback] = useState(() => verificationDestination(redirectTo));
  const target = redirectTo ? verificationDestination(redirectTo) : fallback;
  const verify = useEmailVerification(token);
  const verified = Boolean(token) && verify.isSuccess;
  const invalid = isInvalidRecoveryLink(verify.error);
  const accountType = verify.data?.user.accountType;
  const signedIn = Boolean(verify.data?.user);

  useEffect(() => {
    if (!verified) return;
    clearAuthRecovery("verification");
    try { localStorage.removeItem(PENDING_ORG_INVITE_KEY); } catch { /* Storage unavailable. */ }
    if (signedIn) navigate(target === "/" ? homePathFor(accountType) : target, { replace: true });
  }, [verified, signedIn, target, accountType, navigate]);

  if (token && verify.isPending) {
    return <div className="flex flex-col gap-4" role="status">
      <h1 className="text-2xl font-medium text-ink">Verifying email</h1>
      <Spinner />
    </div>;
  }

  if (verified) {
    return <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-medium text-ink">Email verified</h1>
      <p className="text-sm text-ink-muted">Your email is verified. Continue to your account.</p>
      <Link to={signInPath(target)}><Button className="w-full">Continue</Button></Link>
    </div>;
  }

  if (token && !invalid) {
    return <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-medium text-ink">Could not verify your email</h1>
      <p role="alert" className="text-sm text-ink-muted">We could not complete verification. Check your connection and try again.</p>
      <Button onClick={() => void verify.refetch()} loading={verify.isFetching} disabled={verify.isFetching}>Try again</Button>
      <Link className="text-sm text-primary-500" to={signInPath(target)}>Back to sign in</Link>
    </div>;
  }

  return <div className="flex flex-col gap-6">
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-medium text-ink">{invalid ? "Verification link expired or invalid" : "Check your email"}</h1>
      <p className="text-sm text-ink-muted">{invalid
        ? "Request a new link below to finish verifying your account."
        : "Open the verification link in your inbox, or request a new one below."}</p>
    </div>
    <VerificationEmailForm initialEmail={email} redirectTo={target} />
    <Link to={signInPath(target)}><Button variant="secondary" className="w-full">Back to sign in</Button></Link>
  </div>;
}
