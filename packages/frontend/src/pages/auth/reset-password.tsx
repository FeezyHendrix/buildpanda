import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/atoms";
import { FormField } from "@/components/molecules";
import { authClient } from "@/lib/auth-client";

export default function ResetPasswordForm() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-gray-900 text-balance">
            Invalid reset link
          </h1>
          <p className="text-sm text-gray-500 text-pretty">
            Invalid or missing reset link.
          </p>
        </div>

        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          Invalid or missing reset link
        </p>

        <Link to="/auth/forgot-password">
          <Button type="button" variant="secondary" className="w-full">
            Back to forgot password
          </Button>
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error: resetError } = await authClient.resetPassword({
      newPassword,
      token: token as string,
    });

    setLoading(false);

    if (resetError) {
      setError(resetError.message ?? "Failed to reset password.");
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-gray-900 text-balance">
            Password reset successfully
          </h1>
          <p className="text-sm text-gray-500 text-pretty">
            Your password has been successfully reset. You can now sign in with
            your new password.
          </p>
        </div>

        <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-600">
          Password reset successfully
        </p>

        <Link to="/auth/sign-in">
          <Button type="button" className="w-full">
            Sign in
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-gray-900 text-balance">
          Set new password
        </h1>
        <p className="text-sm text-gray-500 text-pretty">
          Enter your new password below.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <FormField
        label="New password"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        minLength={8}
        required
      />

      <FormField
        label="Confirm password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
      />

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Resetting..." : "Reset Password"}
      </Button>
    </form>
  );
}
