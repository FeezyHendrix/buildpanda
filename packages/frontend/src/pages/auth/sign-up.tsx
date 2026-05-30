import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/atoms";
import { CountrySelect } from "@/components/atoms";
import { FormField } from "@/components/molecules";
import { Label } from "@/components/atoms";
import { authClient } from "@/lib/auth-client";
import type { Country } from "@/lib/countries";

export default function SignUpForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState<Country | null>(null);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signUpError } = await authClient.signUp.email({
      name,
      email,
      password,
      country: country?.code ?? "",
      phone,
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message ?? "Failed to create account.");
      return;
    }

    navigate("/auth/verify-email");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl font-bold text-gray-900 text-balance">
          Create your account
        </h1>
        <p className="text-sm text-gray-500 text-pretty">
          Join thousands of diaspora members building with confidence.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-4">
        <FormField
          label="Full name"
          name="name"
          placeholder="John Doe"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

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

        <FormField
          label="Password"
          name="password"
          type="password"
          placeholder="Create a password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Country</Label>
            <CountrySelect value={country} onChange={setCountry} />
          </div>

          <FormField
            label="Phone number"
            name="phone"
            type="tel"
            placeholder={country?.dialCode ?? "+1"}
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col items-center gap-1 text-center text-xs text-gray-400 text-pretty">
        <p className="inline-flex items-center gap-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="inline size-3.5 shrink-0"
          >
            <rect width={18} height={11} x={3} y={11} rx={2} ry={2} />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Your data is encrypted and protected.
        </p>
        <p>
          By creating an account, you agree to our{" "}
          <Link to="/terms" className="text-[#004DE7] underline hover:text-[#0041c4]">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="text-[#004DE7] underline hover:text-[#0041c4]">
            Privacy Policy
          </Link>
          .
        </p>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creating account..." : "Create Account"}
      </Button>
    </form>
  );
}
