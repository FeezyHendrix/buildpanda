import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/atoms";
import { FormField } from "@/components/molecules";
import { authClient } from "@/lib/auth-client";
import { BackArrowIcon } from "@/components/atoms/project-nav-icons";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: resetError } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/auth/reset-password",
    });

    setLoading(false);

    if (resetError) {
      setError(resetError.message ?? "Failed to send reset link.");
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h4 className="text-h4 font-bold text-black-500">
            Check your email
          </h4>
          <p className="text-caption-l text-grey-450 max-w-[412px]">
            We sent a password reset link to <strong>{email}</strong>. Check
            your inbox and follow the instructions.
          </p>
        </div>

        <Link to="/auth/sign-in">
          <Button type="button" size='lg' className="w-full">
            Back to sign in
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Link
        to="/auth/sign-in"
        aria-label="Back to sign in" className="flex items-center justify-start gap-1 cursor-pointer -mb-2"
      >
        <BackArrowIcon className="size-5" />
        <p className="text-caption-l font-medium text-black-500">Back</p>
      </Link>
      <div className="flex flex-col gap-1">
        <h4 className="text-h4 font-bold text-black-500">
          Reset Your Password
        </h4>
        <p className="text-caption-l text-grey-450 max-w-[412px]">
          Enter the email address associated with your account, and we'll send you a link to reset your password.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <FormField
        label="Email address"
        name="email"
        type="email"
        placeholder="you@example.com"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <Button type="submit" className="w-full h-[48px]" disabled={loading || !email}>
        {loading ? "Sending..." : "Send Reset Link"}
      </Button>
    </form>
  );
}
