import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { FormField } from "@/components/molecules/form-field";
import { useRequestPasswordReset } from "@/hooks/use-auth-recovery";
import { authRecoveryPath, readAuthRecovery, rememberAuthRecovery } from "@/lib/auth-recovery";
import { safeReturnPath, signInPath } from "@/lib/return-path";
import { errorMessage } from "@/lib/api-error";

export default function ForgotPasswordForm() {
  const [params] = useSearchParams();
  const [saved] = useState(() => readAuthRecovery("password"));
  const [email, setEmail] = useState(saved?.email ?? "");
  const redirectTo = safeReturnPath(params.get("redirect")) ?? saved?.redirectTo ?? null;
  const reset = useRequestPasswordReset();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reset.isPending) return;
    reset.mutate({ email: email.trim(), redirectTo: authRecoveryPath("reset-password", redirectTo) }, {
      onSuccess: () => rememberAuthRecovery("password", email.trim(), redirectTo),
    });
  }

  if (reset.isSuccess) {
    return <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-medium text-ink">Check your email</h1>
        <p className="text-sm text-ink-muted">If an account exists for <strong>{email}</strong>, you’ll receive a password reset link. Check your spam folder too.</p>
      </div>
      <Button variant="secondary" onClick={() => reset.reset()}>Use a different email</Button>
      <Link className="text-sm text-primary-500" to={signInPath(redirectTo ?? "/")}>Back to sign in</Link>
    </div>;
  }

  return <form onSubmit={handleSubmit} className="flex flex-col gap-6">
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-medium text-ink">Reset your password</h1>
      <p className="text-sm text-ink-muted">Enter the email address linked to your account and we’ll send you a reset link.</p>
    </div>
    {reset.error ? <p role="alert" className="text-sm text-negative-600">{errorMessage(reset.error)}</p> : null}
    <FormField label="Email address" name="email" type="email" placeholder="you@example.com" autoComplete="email" disabled={reset.isPending}
      value={email} onChange={event => setEmail(event.target.value)} required />
    <Button type="submit" className="w-full h-[48px]" loading={reset.isPending} disabled={reset.isPending}>Send reset link</Button>
    <Link className="text-sm text-primary-500" to={signInPath(redirectTo ?? "/")}>Back to sign in</Link>
  </form>;
}
