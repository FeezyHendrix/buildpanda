import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/atoms";
import { FormField } from "@/components/molecules";
import { authClient } from "@/lib/auth-client";

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
          <h1 className="text-2xl font-bold text-gray-900 text-balance">
            Check your email
          </h1>
          <p className="text-sm text-gray-500 text-pretty">
            We sent a password reset link to <strong>{email}</strong>. Check
            your inbox and follow the instructions.
          </p>
        </div>

        <Link to="/auth/sign-in">
          <Button type="button" variant="secondary" className="w-full">
            Back to sign in
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-gray-900 text-balance">
          Reset your password
        </h1>
        <p className="text-sm text-gray-500 text-pretty">
          Enter the email address linked to your account and we'll send you a
          reset link.
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

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Sending..." : "Send reset link"}
      </Button>
    </form>
  );
}
