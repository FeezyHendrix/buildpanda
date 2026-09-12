import { useEffect, useState } from "react";
import { Button } from "@/components/atoms/button";
import { Label } from "@/components/atoms/label";
import { INPUT_CLASS } from "@/components/atoms/input";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { useOrgProfile, useUpdateOrgProfile } from "@/hooks/use-org-profile";
import { Spinner } from "@/components/atoms/spinner";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function OrgTab() {
  const { data: orgProfile, isPending } = useOrgProfile();
  const updateOrgProfile = useUpdateOrgProfile();

  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");

  const [defaultCurrency, setDefaultCurrency] = useState("USD");
  const [defaultTaxLabel, setDefaultTaxLabel] = useState("Tax");
  const [defaultTaxPct, setDefaultTaxPct] = useState(0);
  const [paymentInstructions, setPaymentInstructions] = useState("");

  useEffect(() => {
    if (orgProfile) {
      setName(orgProfile.name ?? "");
      setContactEmail(orgProfile.contactEmail ?? "");
      setPhone(orgProfile.phone ?? "");
      setWebsite(orgProfile.website ?? "");
      setAddress(orgProfile.address ?? "");
      setDefaultCurrency(orgProfile.defaultCurrency ?? "USD");
      setDefaultTaxLabel(orgProfile.defaultTaxLabel ?? "Tax");
      setDefaultTaxPct(orgProfile.defaultTaxPct ?? 0);
      setPaymentInstructions(orgProfile.paymentInstructions ?? "");
    }
  }, [orgProfile]);

  if (isPending) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Spinner size="md" />
      </div>
    );
  }

  function handleSaveDetails() {
    const normalizedContactEmail = contactEmail.trim().toLowerCase();
    if (normalizedContactEmail && !EMAIL_PATTERN.test(normalizedContactEmail)) {
      toast("Enter a valid contact email");
      return;
    }
    updateOrgProfile.mutate(
      {
        name: name.trim(),
        contactEmail: normalizedContactEmail || null,
        phone: phone.trim() || null,
        website: website.trim() || null,
        address: address.trim() || null,
      },
      {
        onSuccess: () => toast("Organization details updated", "success"),
        onError: () => toast("Could not update organization details"),
      },
    );
  }

  function handleSaveFinancials() {
    updateOrgProfile.mutate(
      {
        defaultCurrency: defaultCurrency.trim(),
        defaultTaxLabel: defaultTaxLabel.trim(),
        defaultTaxPct: Number(defaultTaxPct) || 0,
        paymentInstructions: paymentInstructions.trim() || undefined,
      },
      {
        onSuccess: () => toast("Financial defaults updated", "success"),
        onError: () => toast("Could not update financial defaults"),
      },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-line-hair bg-white shadow-card">
        <div className="border-b border-line-hair px-6 py-4">
          <h3 className="text-base font-semibold text-ink">
            Organization details
          </h3>
          <p className="mt-1 text-sm text-ink-muted">
            Basic information about your company.
          </p>
        </div>
        <div className="flex flex-col gap-4 px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="org-name">Company name</Label>
              <input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="org-email">Contact email</Label>
              <input
                id="org-email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                onBlur={(e) => setContactEmail(e.target.value.trim().toLowerCase())}
                className={INPUT_CLASS}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="org-phone">Phone</Label>
              <input
                id="org-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="org-website">Website</Label>
              <input
                id="org-website"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="org-address">Address</Label>
              <input
                id="org-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </div>
        <div className="border-t border-line-hair bg-surface-alt px-6 py-4 flex justify-end rounded-b-lg">
          <Button onClick={handleSaveDetails} loading={updateOrgProfile.isPending}>
            Save changes
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-line-hair bg-white shadow-card">
        <div className="border-b border-line-hair px-6 py-4">
          <h3 className="text-base font-semibold text-ink">
            Financial defaults
          </h3>
          <p className="mt-1 text-sm text-ink-muted">
            Default settings for proposals, invoices, and payments.
          </p>
        </div>
        <div className="flex flex-col gap-4 px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="org-currency">Default currency</Label>
              <input
                id="org-currency"
                value={defaultCurrency}
                onChange={(e) => setDefaultCurrency(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="org-tax-label">Tax label</Label>
              <input
                id="org-tax-label"
                value={defaultTaxLabel}
                onChange={(e) => setDefaultTaxLabel(e.target.value)}
                placeholder="e.g. VAT, GST, Sales Tax"
                className={INPUT_CLASS}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="org-tax-pct">Default tax %</Label>
              <input
                id="org-tax-pct"
                type="number"
                step="0.01"
                min="0"
                value={defaultTaxPct}
                onChange={(e) => setDefaultTaxPct(Number(e.target.value))}
                className={INPUT_CLASS}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-3">
              <Label htmlFor="org-payment-inst">Payment instructions</Label>
              <textarea
                id="org-payment-inst"
                value={paymentInstructions}
                onChange={(e) => setPaymentInstructions(e.target.value)}
                rows={4}
                className={cn(INPUT_CLASS, "min-h-24 py-3")}
                placeholder="Bank transfer details, payment terms, etc."
              />
            </div>
          </div>
        </div>
        <div className="border-t border-line-hair bg-surface-alt px-6 py-4 flex justify-end rounded-b-lg">
          <Button onClick={handleSaveFinancials} loading={updateOrgProfile.isPending}>
            Save defaults
          </Button>
        </div>
      </div>
    </div>
  );
}
