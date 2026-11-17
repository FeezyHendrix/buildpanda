import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@field-ui/button";
import { Input } from "@field-ui/input";
import { authApi } from "../api/auth";
import { ErrorMessage } from "./notice";

export function SignInForm({ onSignedIn, buildPandaUrl }: { onSignedIn: () => Promise<void>; buildPandaUrl: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const signIn = useMutation({
    gcTime: 0,
    mutationFn: () => authApi.signIn(email.trim(), password),
    onSuccess: async () => { setPassword(""); await onSignedIn(); },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!signIn.isPending) signIn.mutate();
  }
  return (
    <section className="max-w-lg rounded-2xl border border-line bg-white p-6" aria-labelledby="sign-in-title">
      <h2 id="sign-in-title" className="text-lg font-semibold">Sign in to connect your site</h2>
      <p className="mt-2 text-sm leading-6 text-ink-muted">Use your existing BuildPanda email and password.</p>
      <form className="mt-5 space-y-4" onSubmit={submit}>
        <label htmlFor="sign-in-email" className="block text-sm font-medium">Email
          <Input id="sign-in-email" name="email" type="email" autoComplete="username" required disabled={signIn.isPending} className="mt-2" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label htmlFor="sign-in-password" className="block text-sm font-medium">Password
          <Input id="sign-in-password" name="password" type="password" autoComplete="current-password" required disabled={signIn.isPending} className="mt-2" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <ErrorMessage error={signIn.error} />
        <Button type="submit" size="lg" aria-label="Sign in" loading={signIn.isPending}>Sign in</Button>
      </form>
      <a href={`${buildPandaUrl}/auth/sign-in`} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary-600 underline">Open BuildPanda for account help</a>
    </section>
  );
}
