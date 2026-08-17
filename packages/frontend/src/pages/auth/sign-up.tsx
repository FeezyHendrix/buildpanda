import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/atoms";
import { FormField } from "@/components/molecules";
import { authClient } from "@/lib/auth-client";
import { PENDING_PROJECT_INVITE_KEY } from "@/lib/route-guards";

export default function SignUpForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const invitedEmail = searchParams.get("email");

  useEffect(() => {
    if (invitedEmail) setEmail(invitedEmail);
  }, [invitedEmail]);

  // Persist a project invite so the redirect survives the email-verification
  // round trip: the verification link opens in a fresh page load with no router
  // state, so verify-email falls back to this key to return the user to the
  // invite instead of the generic home page.
  useEffect(() => {
    const match = redirectTo?.match(/^\/accept-project-invite\/([^/?]+)/);
    if (match?.[1]) {
      window.localStorage.setItem(PENDING_PROJECT_INVITE_KEY, match[1]);
    }
  }, [redirectTo]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // better-auth's core sign-up schema requires `name`; this form collects it
    // later in onboarding (POST /v2/onboarding overwrites it from
    // firstName+lastName). Whatever we send is discarded — the server always
    // derives the placeholder from the email — so send it blank rather than
    // inventing one here.
    const { error: signUpError } = await authClient.signUp.email({
      name: "",
      email,
      password,
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message ?? "Failed to create account.");
      return;
    }

    navigate("/auth/verify-email", { state: { email, redirectTo } });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h4 className="text-h4 font-bold text-black-500">
          Create Your Account
        </h4>
        <p className="text-caption-l text-grey-450 max-w-[412px]">
          Run the whole build journey from one dashboard.
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

        <FormField
          label="Password"
          name="password"
          type="password"
          placeholder="Create a strong password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <div className="flex flex-col items-center gap-1 text-center mt-4 text-pretty">
        <p className='text-caption-l font-medium text-grey-450'>
          By creating an account, you agree to our{" "}
          <Link to="/terms" className="text-black-500 font-bold">
            Terms Of Service
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="text-black-500 font-bold">
            Privacy Policy
          </Link>
          .
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <Button type="submit" className="w-full h-[48px]" loading={loading}>
          Create Account
        </Button>
        
        <div className="flex items-center justify-center gap-1">
          <p className="text-caption-l font-medium text-[#787878]">Already have an account?</p>
          <Link
            to="/auth/sign-in"
            className="text-caption-l font-bold text-primary hover:none"
          >
            Login
          </Link>
        </div>
      </div>
    </form>
  );
}
