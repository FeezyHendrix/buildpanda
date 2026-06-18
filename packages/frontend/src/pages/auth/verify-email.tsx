import { useState, useEffect, useRef } from "react";
import { Link, useSearchParams, useLocation } from "react-router-dom";
import { Button } from "@/components/atoms";
import { authClient } from "@/lib/auth-client";

const RESEND_COOLDOWN_S = 30;

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email ?? null;

  const [loading, setLoading] = useState(!!token);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    async function verify() {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"}/api/auth/verify-email?token=${token}`,
          { credentials: "include" }
        );

        if (!isMounted) return;

        if (res.ok) {
          setSuccess(true);
        } else {
          setError("Verification failed. The link may have expired.");
        }
      } catch (err) {
        if (!isMounted) return;
        setError("Verification failed. The link may have expired.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    verify();

    return () => {
      isMounted = false;
    };
  }, [token]);

  if (!token) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-gray-900 text-balance">
            Check your email
          </h1>
          <p className="text-sm text-gray-500 text-pretty">
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
            <Button type="button" variant="secondary" className="w-full">
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

        {/* "/" routes each account type to its home (owners → My Build). */}
        <Link to="/">
          <Button type="button" className="w-full">
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
        <Button type="button" variant="secondary" className="w-full">
          Back to sign in
        </Button>
      </Link>
    </div>
  );
}
