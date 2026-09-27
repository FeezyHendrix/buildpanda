import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/atoms/button";
import { FormField } from "@/components/molecules/form-field";
import { useResendVerification } from "@/hooks/use-auth-recovery";
import { rememberAuthRecovery } from "@/lib/auth-recovery";
import { errorMessage } from "@/lib/api-error";

export function VerificationEmailForm({ initialEmail, redirectTo }: { initialEmail: string; redirectTo: string | null }) {
  const [email, setEmail] = useState(initialEmail);
  const [cooldown, setCooldown] = useState(0);
  const resend = useResendVerification();

  useEffect(() => {
    if (cooldown === 0) return;
    const timer = setTimeout(() => setCooldown(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (resend.isPending || cooldown > 0) return;
    resend.mutate({ email: email.trim(), callbackURL: redirectTo ?? "/" }, {
      onSuccess: () => {
        rememberAuthRecovery("verification", email.trim(), redirectTo);
        setCooldown(30);
      },
    });
  }

  return <form onSubmit={submit} className="flex flex-col gap-3">
    <FormField label="Email address" name="email" type="email" autoComplete="email" required disabled={resend.isPending}
      value={email} onChange={event => { setEmail(event.target.value); resend.reset(); }} />
    {resend.isSuccess ? <p role="status" className="text-sm text-success-600">Verification email sent. Check your inbox.</p> : null}
    {resend.error ? <p role="alert" className="text-sm text-negative-600">{errorMessage(resend.error)}</p> : null}
    <Button type="submit" className="w-full" loading={resend.isPending} disabled={resend.isPending || cooldown > 0}>
      {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend verification email"}
    </Button>
  </form>;
}
VerificationEmailForm.displayName = "VerificationEmailForm";
