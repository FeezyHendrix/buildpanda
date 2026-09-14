import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { FormField } from "@/components/molecules/form-field";
import { isInvalidRecoveryLink } from "@/api/auth-recovery";
import { useResetPassword } from "@/hooks/use-auth-recovery";
import { authRecoveryPath, clearAuthRecovery, readAuthRecovery } from "@/lib/auth-recovery";
import { errorMessage } from "@/lib/api-error";
import { safeReturnPath, signInPath } from "@/lib/return-path";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  return <ResetPasswordForm key={token} token={token} redirect={safeReturnPath(params.get("redirect"))} />;
}

function ResetPasswordForm({ token, redirect }: { token: string | null; redirect: string | null }) {
  const [saved] = useState(() => readAuthRecovery("password"));
  const redirectTo = redirect ?? saved?.redirectTo ?? "/";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const reset = useResetPassword();

  if (!token || isInvalidRecoveryLink(reset.error)) {
    return <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-medium text-ink">Reset link expired or invalid</h1>
      <p className="text-sm text-ink-muted">Request a new password reset link to continue.</p>
      <Link to={authRecoveryPath("forgot-password", redirectTo)}><Button className="w-full">Request a new link</Button></Link>
    </div>;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || reset.isPending) return;
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    reset.mutate({ newPassword, token }, { onSuccess: () => {
      clearAuthRecovery("password");
      setNewPassword("");
      setConfirmPassword("");
    } });
  }

  if (reset.isSuccess) {
    return <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-medium text-ink">Password reset successfully</h1>
      <p className="text-sm text-ink-muted">Sign in with your new password to continue where you left off.</p>
      <Link to={signInPath(redirectTo)}><Button className="w-full">Sign in</Button></Link>
    </div>;
  }

  return <form onSubmit={handleSubmit} className="flex flex-col gap-6">
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-medium text-ink">Set new password</h1>
      <p className="text-sm text-ink-muted">Use at least 8 characters.</p>
    </div>
    {error || reset.error ? <p role="alert" className="text-sm text-negative-600">{error ?? errorMessage(reset.error)}</p> : null}
    <FormField label="New password" name="newPassword" type="password" autoComplete="new-password" minLength={8} disabled={reset.isPending}
      value={newPassword} onChange={event => setNewPassword(event.target.value)} required />
    <FormField label="Confirm password" name="confirmPassword" type="password" autoComplete="new-password" disabled={reset.isPending}
      value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required />
    <Button type="submit" className="w-full h-[48px]" loading={reset.isPending} disabled={reset.isPending}>Reset Password</Button>
  </form>;
}
