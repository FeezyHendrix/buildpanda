import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { authClient } from "@/lib/auth-client";
import { useOnboardingContext } from "@/layouts/onboarding-layout";
import { Button } from "@/components/atoms/button";
import { Label } from "@/components/atoms";
import { FormField } from "@/components/molecules/form-field";
import { CountrySelect } from "@/components/atoms/country-select";
import { countries } from "@/lib/countries";

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-8 flex items-center gap-1.5 text-[13px] font-medium text-[#767676] transition-colors hover:text-[#1E1E1E]"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10 12L6 8l4-4" />
      </svg>
      Back
    </button>
  );
}

export default function OnboardingRepresentative() {
  const { data, update } = useOnboardingContext();
  const navigate = useNavigate();
  const { data: sessionData } = authClient.useSession();
  const { firstName, lastName, email, phoneCountryCode, phone } = data;

  const emailInitialized = useRef(false);
  useEffect(() => {
    if (emailInitialized.current) return;
    const sessionEmail =
      (sessionData?.user as { email?: string } | undefined)?.email ?? "";
    if (sessionEmail) {
      emailInitialized.current = true;
      update({ email: sessionEmail });
    }
  }, [sessionData?.user, update]);

  const selectedPhoneCountry =
    countries.find((c) => c.code === phoneCountryCode) ?? null;
  const dialCode = selectedPhoneCountry?.dialCode ?? "+234";

  const canContinue = Boolean(firstName.trim() && lastName.trim() && email.trim());

  return (
    <div>
      <BackButton onClick={() => navigate("/onboarding")} />

      <h1 className="font-heading text-[28px] font-bold leading-tight text-[#1E1E1E]">
        Representative Information
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-[#767676]">
        These are the details of the individual opening the account for the company
      </p>

      <div className="mt-8 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="First Name"
            placeholder="Michael"
            value={firstName}
            onChange={(e) => update({ firstName: e.target.value })}
          />
          <FormField
            label="Last Name"
            placeholder="Scott"
            value={lastName}
            onChange={(e) => update({ lastName: e.target.value })}
          />
        </div>

        <FormField
          label="Email"
          type="email"
          placeholder="name@mail.com"
          value={email}
          onChange={(e) => update({ email: e.target.value })}
        />

        {/* Phone — compound: country-code picker + number input sharing one border */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-caption-l text-black-500">Phone Number</Label>
          <div className="flex border-[0.5px] border-[#EBEBEB] transition-colors focus-within:border-black-500 h-[45px]">
            <CountrySelect
              codeOnly
              value={selectedPhoneCountry}
              onChange={(c) => update({ phoneCountryCode: c?.code ?? "NG" })}
              className="w-[80px] shrink-0 border-0 border-r border-[#EBEBEB] focus-visible:ring-0"
            />
            <input
              type="tel"
              placeholder={dialCode}
              value={phone}
              onChange={(e) => update({ phone: e.target.value })}
              className="h-11 flex-1 bg-white px-3.5 text-[14px] text-[#1E1E1E] placeholder:text-[#B0B0B0] outline-none"
            />
          </div>
        </div>
      </div>

      <div className="mt-10">
        <Button
          className="w-full h-[46px] disabled:bg-grey-50 disabled:text-black-500"
          disabled={!canContinue}
          onClick={() => navigate("/onboarding/usage")}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
