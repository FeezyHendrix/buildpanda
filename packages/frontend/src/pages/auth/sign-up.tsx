import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/atoms";
import { CountrySelect } from "@/components/atoms";
import { RadioCard } from "@/components/atoms";
import { SearchableSelect } from "@/components/atoms";
import { FormField } from "@/components/molecules";
import { Label } from "@/components/atoms";
import { authClient } from "@/lib/auth-client";
import type { Country } from "@/lib/countries";

const ACCOUNT_TYPES = [
  {
    id: "project_owner",
    title: "Project Owner",
    description: "You own the project and oversee its delivery.",
  },
  {
    id: "construction_company",
    title: "Construction Company",
    description: "You are the construction team delivering the build.",
  },
  {
    id: "project_manager",
    title: "Project Manager",
    description: "You manage delivery as a builder, QS, architect, or similar.",
  },
] as const;

const PROFESSIONS = [
  "Builder",
  "Quantity Surveyor",
  "Architect",
  "Engineer",
  "Site Supervisor",
  "Other",
] as const;

type AccountType = (typeof ACCOUNT_TYPES)[number]["id"];

export default function SignUpForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [profession, setProfession] = useState<string | null>(null);
  const [country, setCountry] = useState<Country | null>(null);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const invitedEmail = searchParams.get("email");

  const isProjectManager = accountType === "project_manager";
  const personaComplete =
    accountType !== null && (!isProjectManager || profession !== null);

  function selectAccountType(value: AccountType) {
    setAccountType(value);
    if (value !== "project_manager") {
      setProfession(null);
    }
  }

  useEffect(() => {
    if (invitedEmail) setEmail(invitedEmail);
  }, [invitedEmail]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!accountType) {
      setError("Please select who is creating this account.");
      return;
    }
    if (isProjectManager && !profession) {
      setError("Please select your profession.");
      return;
    }

    setLoading(true);

    const { error: signUpError } = await authClient.signUp.email({
      name,
      email,
      password,
      country: country?.code ?? "",
      phone,
      accountType,
      profession: isProjectManager ? (profession ?? "") : "",
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
        <div className="flex flex-col gap-3">
          <Label>Who is creating this account?</Label>
          <div className="flex flex-col gap-3">
            {ACCOUNT_TYPES.map((type) => (
              <RadioCard
                key={type.id}
                title={type.title}
                description={type.description}
                selected={accountType === type.id}
                onClick={() => selectAccountType(type.id)}
              />
            ))}
          </div>

          {isProjectManager && (
            <div className="flex flex-col gap-1.5">
              <Label>Your profession</Label>
              <SearchableSelect
                items={PROFESSIONS}
                value={profession}
                onChange={setProfession}
                placeholder="Select your profession"
                searchPlaceholder="Search professions…"
              />
            </div>
          )}
        </div>

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

      <Button type="submit" className="w-full h-[48px]" disabled={loading || !personaComplete}>
        {loading ? "Creating account..." : "Create Account"}
      </Button>
    </form>
  );
}
