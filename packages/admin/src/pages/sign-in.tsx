import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { authClient } from "@/lib/auth-client";
import { Button, Card, Input } from "@/components/ui";

export default function SignInPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signInError } = await authClient.signIn.email({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message ?? "Invalid email or password.");
      return;
    }
    navigate("/", { replace: true });
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-surface-faint p-6">
      <Card className="w-full max-w-md p-8">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="BuildPanda" className="h-8 w-auto" />
            <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand">
              Admin
            </span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-ink">Sign in to the admin panel</h1>
            <p className="mt-1 text-sm text-muted">Platform administrators only.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error ? (
            <p className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>
          ) : null}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Email address</span>
            <Input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@buildpanda.io"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Password</span>
            <Input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>
          <Button type="submit" disabled={loading} className="mt-1 w-full">
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
