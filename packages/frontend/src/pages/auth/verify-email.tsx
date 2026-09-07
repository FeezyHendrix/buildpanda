import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { Button } from "@/components/atoms";
import { authClient } from "@/lib/auth-client";
import { useSession } from "@/stores/auth";
import {
  PENDING_ORG_INVITE_KEY,
  PENDING_PROJECT_INVITE_KEY,
  homePathFor,
} from "@/lib/route-guards";
import { onboardingApi } from "@/api/onboarding";

function continueAfterVerifyPath(redirectTo?: string | null): string {
  // Org invitations are auto-accepted at sign-up, so bouncing back to the
  // accept-invitation page would just show "already handled". Send them home.
  const pendingOrgInvite = localStorage.getItem(PENDING_ORG_INVITE_KEY);
  if (pendingOrgInvite) {
    localStorage.removeItem(PENDING_ORG_INVITE_KEY);
    return "/";
  }
  if (redirectTo?.startsWith("/accept-invitation/")) return "/";
  if (redirectTo) return redirectTo;
  const pendingProjectInvite = localStorage.getItem(PENDING_PROJECT_INVITE_KEY);
  return pendingProjectInvite
    ? `/accept-project-invite/${pendingProjectInvite}`
    : "/";
}

const RESEND_COOLDOWN_S = 30;

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { email?: string; redirectTo?: string | null } | null;
  const email = state?.email ?? null;
  const redirectTo = state?.redirectTo ?? null;

  const [loading, setLoading] = useState(!!token);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);
  const { data: session } = useSession();

  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  async function handleResend() {
    if (!email || resending || cooldown > 0) return;

    setResending(true);
    setResent(false);
    setResendError(null);

    const { error: sendError } = await authClient.sendVerificationEmail({
      email,
      callbackURL: "/",
    });

    setResending(false);

    if (sendError) {
      setResendError(sendError.message ?? "Couldn't resend the email. Please try again.");
      return;
    }

    setResent(true);
    setCooldown(RESEND_COOLDOWN_S);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  useEffect(() => {
    if (!token) return;

    let isMounted = true;

    async function verify(verificationToken: string) {
      // Verify through authClient rather than a bare fetch: better-auth only
      // refreshes the session store that backs useSession() (and therefore the
      // route guards) for calls that go through the client.
      const { error: verifyError } = await authClient.verifyEmail({
        query: { token: verificationToken },
      });

      if (!isMounted) return;

      if (verifyError) {
        setError("Verification failed. The link may have expired.");
      } else {
        setSuccess(true);
        setPendingRedirect(continueAfterVerifyPath(redirectTo));
      }
      setLoading(false);
    }

    verify(token);

    return () => {
      isMounted = false;
    };
  }, [token, redirectTo]);

  // autoSignInAfterVerification signs the user in on the verify response, so
  // land them in-app instead of asking them to click Continue — but only once
  // useSession() reports the user, or the guard on the destination still sees a
  // signed-out visitor and bounces to /auth/sign-in.
  useEffect(() => {
    if (!pendingRedirect || !session?.user) return;
    const user = session.user as { accountType?: string; id?: string };

    if (pendingRedirect !== "/") {
      navigate(pendingRedirect, { replace: true });
      return;
    }

    // An invited employee lands in an org whose onboarding may already be
    // complete (done by whoever invited them) — check the server rather than
    // trusting this browser's localStorage.
    let cancelled = false;
    void (async () => {
      const status =
        user.accountType === "project_owner"
          ? null
          : await onboardingApi.status().catch(() => null);
      if (!cancelled) {
        navigate(homePathFor(user.accountType, user.id, status?.completed), {
          replace: true,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pendingRedirect, session, navigate]);

  if (!token) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h4 className="text-h4 font-bold text-black-500">
            Check your email
          </h4>
          <p className="text-caption-l text-grey-450 max-w-[412px]">
            We sent a verification link
            {email ? (
              <>
                {" "}to <span className="font-semibold text-gray-700">{email}</span>
              </>
            ) : null}
            . Check your inbox and click the link to verify your account.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {resent ? (
            <p className="text-sm text-green-600 text-pretty" role="status">
              Verification email sent. Check your inbox.
            </p>
          ) : null}
          {resendError ? (
            <p className="text-sm text-red-600 text-pretty" role="alert">
              {resendError}
            </p>
          ) : null}

          <Button
            type="button"
            size='lg'
            className="w-full"
            onClick={handleResend}
            disabled={!email || resending || cooldown > 0}
          >
            {resending
              ? "Sending..."
              : cooldown > 0
                ? `Resend in ${cooldown}s`
                : "Resend verification email"}
          </Button>

          {!email ? (
            <p className="text-xs text-gray-400 text-pretty text-center">
              Sign in to resend your verification email.
            </p>
          ) : null}

          <Link to="/auth/sign-in">
            <Button type="button" size='lg' className="w-full">
              Back to sign in
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-gray-900 text-balance">
            Verifying email
          </h1>
          <p className="text-sm text-gray-500 text-pretty">
            Verifying your email...
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-gray-900 text-balance">
            Email verified
          </h1>
          <p className="text-sm text-gray-500 text-pretty">
            Your email has been successfully verified.
          </p>
        </div>

        <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-600">
          Email verified!
        </p>

        <Link to={pendingRedirect ?? "/"}>
          <Button type="button" className="w-full h-[48px]">
            Continue
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-gray-900 text-balance">
          Verification failed
        </h1>
        <p className="text-sm text-gray-500 text-pretty">
          We could not verify your email address.
        </p>
      </div>

      <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
        {error}
      </p>

      <Link to="/auth/sign-in">
        <Button type="button" variant="secondary" className="w-full h-[48px]">
          Back to sign in
        </Button>
      </Link>
    </div>
  );
}
