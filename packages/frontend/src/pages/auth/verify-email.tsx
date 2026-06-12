import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/atoms";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(!!token);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            We sent you a verification link. Check your inbox and click the link
            to verify your account.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Button type="button" className="w-full" disabled>
            Resend verification email
          </Button>

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
