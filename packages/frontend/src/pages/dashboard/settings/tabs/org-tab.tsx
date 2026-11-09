import { useEffect, useState } from "react";
import { Button } from "@/components/atoms/button";
import { toast } from "@/lib/toast";
import { useOrgProfile, useUpdateOrgProfile } from "@/hooks/use-org-profile";
import { Spinner } from "@/components/atoms/spinner";
import { FormSection } from "@/components/atoms/form-section";
import { TextInput } from "@/components/atoms/text-input";
import { TextArea } from "@/components/atoms/text-area";
import { cn } from "@/lib/utils";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function OrgTab() {
  const { data: orgProfile, isPending } = useOrgProfile();
  const saveDetails = useUpdateOrgProfile();
  const saveFinancials = useUpdateOrgProfile();

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
    saveDetails.mutate(
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
    saveFinancials.mutate(
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
      <FormSection title="Organisation Details">
        <div className="grid grid-cols-2 gap-4">
          <TextInput
            label="Company Name"
            placeholder="Give a name to your project"
            value={name}
            onChange={setName}
          />

          <TextInput
            type='email'
            label="Company email"
            placeholder="Enter your email"
            value={contactEmail}
            onChange={setContactEmail}
            optional
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <TextInput
          label="Phone"
          placeholder="Enter your phone number"
          value={phone}
          onChange={setPhone}
        />
        <TextInput
          label="Company Website"
          placeholder="Enter your website"
          value={website}
          onChange={setWebsite}
          optional
        />
        </div>
        <TextInput
          label="Address"
          placeholder="Enter your address"
          value={address}
          onChange={setAddress}
        />
        <div className="flex justify-end">
          <Button
            size='lg'
            onClick={handleSaveDetails}
            loading={saveDetails.isPending}
            disabled={saveDetails.isPending}
            className={cn(
              saveDetails.isPending
                ? "disabled:bg-primary-500 disabled:text-white disabled:opacity-100"
                : "disabled:bg-grey-50 disabled:text-black-500 disabled:opacity-100"
            )}
          >
            Save Changes
          </Button>
        </div>
      </FormSection>

      <FormSection title="Financial Details">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextInput
            label="Default currency"
            placeholder="Enter your default currency"
            value={defaultCurrency}
            onChange={setDefaultCurrency}
          />

          <TextInput
            label="Tax label"
            placeholder="e.g. VAT, GST, Sales Tax"
            value={defaultTaxLabel}
            onChange={setDefaultTaxLabel}
          />

          <TextInput
            type='number'
            label="Default tax %"
            placeholder="Enter your tax percentage"
            value={String(defaultTaxPct)}
            onChange={(v) => setDefaultTaxPct(Number(v))}
          />
        </div>

        <TextArea
          label="Payment instructions"
          placeholder="Bank transfer details, payment terms, etc."
          value={paymentInstructions}
          onChange={setPaymentInstructions}
          optional
        />

        <div className="flex justify-end">
          <Button
            size='lg'
            onClick={handleSaveFinancials}
            loading={saveFinancials.isPending}
            disabled={saveFinancials.isPending}
            className={cn(
              saveFinancials.isPending
                ? "disabled:bg-primary-500 disabled:text-white disabled:opacity-100"
                : "disabled:bg-grey-50 disabled:text-black-500 disabled:opacity-100"
            )}
          >
            Save Changes
          </Button>
        </div>
      </FormSection>
    </div>
  );
}
