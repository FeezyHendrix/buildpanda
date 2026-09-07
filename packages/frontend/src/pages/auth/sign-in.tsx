import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/atoms";
import { FormField } from "@/components/molecules";
import { authClient } from "@/lib/auth-client";
import { useSession } from "@/stores/auth";
import { homePathFor } from "@/lib/route-guards";
import { onboardingApi } from "@/api/onboarding";

export default function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const { data: session } = useSession();

  useEffect(() => {
    if (pendingRedirect && session?.user) {
      navigate(pendingRedirect, { replace: true });
    }
  }, [pendingRedirect, session, navigate]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    await authClient.signIn.email(
      { email, password },
      {
        onSuccess: async (ctx) => {
          const user = ctx.data?.user as { accountType?: string; id?: string } | undefined;
          // homePathFor falls back to a localStorage flag when the server
          // status is unknown; fetch it so an already-onboarded user signing
          // in on a fresh browser lands in-app instead of back at onboarding.
          // Project owners skip onboarding entirely, so skip the fetch too.
          const status =
            user?.accountType === "project_owner"
              ? null
              : await onboardingApi.status().catch(() => null);
          setPendingRedirect(
            redirectTo ?? homePathFor(user?.accountType, user?.id, status?.completed),
          );
        },
        onError: (ctx) => {
          setLoading(false);
          setError(ctx.error.message ?? "Invalid email or password.");
        },
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h4 className="text-h4 font-bold text-black-500">
          Welcome back
        </h4>
        <p className="text-caption-l text-grey-450 max-w-[412px]">
          Sign in to access your projects, track progress, and manage your construction workflow.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-4">
        <FormField
          label="Business Email"
          name="email"
          type="email"
          placeholder="name@mail.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <div className='flex flex-col gap-2'>
          <FormField
            label="Password"
            name="password"
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Link
            to="/auth/forgot-password"
            className="text-caption-l font-bold text-primary hover:none w-40"
          >
            Forgot password?
          </Link>
        </div>

      </div>


      <div className="flex flex-col gap-4">
        <Button type="submit" className="w-full h-[48px]" disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </Button>

        <div className="flex items-center justify-center gap-1">
          <p className="text-caption-l font-medium text-[#787878]">New to BuildPanda?</p>
          <Link
            to="/auth/sign-up"
            className="text-caption-l font-bold text-primary hover:none"
          >
            Create an account
          </Link>
        </div>
      </div>
    </form>
  );
}
