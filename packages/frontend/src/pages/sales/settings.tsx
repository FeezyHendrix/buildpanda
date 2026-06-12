import { useEffect, useState } from "react";
import { Input } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { Button } from "@/components/atoms/button";
import { useOrgProfile, useUpdateOrgProfile } from "@/hooks/use-org-profile";
import { cn } from "@/lib/utils";

const CURRENCIES = ["NGN", "USD", "GBP", "EUR", "GHS", "ZAR", "KES"] as const;

const selectClass = cn(
  "h-11 w-full rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900",
  "border-0 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
);

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export default function SalesSettings() {
  const { data: profile, isLoading } = useOrgProfile();
  const update = useUpdateOrgProfile();

  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState("NGN");
  const [defaultTaxLabel, setDefaultTaxLabel] = useState("VAT");
  const [defaultTaxPct, setDefaultTaxPct] = useState("7.5");

  useEffect(() => {
    if (profile) {
      setPhone(profile.phone ?? "");
      setAddress(profile.address ?? "");
      setContactEmail(profile.contactEmail ?? "");
      setWebsite(profile.website ?? "");
      setDefaultCurrency(profile.defaultCurrency);
      setDefaultTaxLabel(profile.defaultTaxLabel);
      setDefaultTaxPct(String(profile.defaultTaxPct));
    }
  }, [profile]);

  function handleSave() {
    update.mutate({
      phone: phone.trim() || null,
      address: address.trim() || null,
      contactEmail: contactEmail.trim() || null,
      website: website.trim() || null,
      defaultCurrency,
      defaultTaxLabel: defaultTaxLabel.trim(),
      defaultTaxPct: parseFloat(defaultTaxPct) || 0,
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-7 animate-spin rounded-full border-2 border-gray-200 border-t-[#004DE7]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 p-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Company profile and estimate defaults.
        </p>
      </div>

      <section className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-900">Company Profile</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldRow label="Company name">
            <Input value={profile?.name ?? ""} disabled placeholder="Company name" />
          </FieldRow>
          <FieldRow label="Contact email">
            <Input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="billing@example.com"
            />
          </FieldRow>
          <FieldRow label="Phone">
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+234 800 000 0000"
            />
          </FieldRow>
          <FieldRow label="Website">
            <Input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
            />
          </FieldRow>
        </div>

        <FieldRow label="Office address">
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={3}
            placeholder="123 Main Street, Lagos, Nigeria"
            className={cn(
              "w-full rounded-lg bg-[#F6F6F6] px-4 py-3 text-sm text-gray-900",
              "border-0 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
              "resize-none placeholder:text-gray-400",
            )}
          />
        </FieldRow>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-900">Estimate Defaults</h2>
        <p className="text-xs text-gray-500">
          These defaults pre-fill new estimates. You can override them per estimate.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FieldRow label="Default currency">
            <select
              value={defaultCurrency}
              onChange={(e) => setDefaultCurrency(e.target.value)}
              className={selectClass}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="Tax label">
            <Input
              value={defaultTaxLabel}
              onChange={(e) => setDefaultTaxLabel(e.target.value)}
              placeholder="VAT"
            />
          </FieldRow>
          <FieldRow label="Tax rate (%)">
            <Input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={defaultTaxPct}
              onChange={(e) => setDefaultTaxPct(e.target.value)}
              placeholder="7.5"
            />
          </FieldRow>
        </div>
      </section>

      {update.isError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          Failed to save. Please try again.
        </p>
      )}
      {update.isSuccess && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">
          Settings saved.
        </p>
      )}

      <div className="flex justify-end">
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={update.isPending}
        >
          {update.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
