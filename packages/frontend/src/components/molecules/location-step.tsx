import { useId } from "react";
import { FormField } from "@/components/molecules/form-field";
import { Label } from "@/components/atoms/label";
import { SearchableSelect } from "@/components/atoms/searchable-select";
import { countries } from "@/lib/countries";
import { ProjectModelField } from "./project-model-field";

const COUNTRY_NAMES = countries.map((country) => country.name);

interface LocationStepProps {
  country: string | null;
  state: string | null;
  city: string;
  onCountryChange: (value: string | null) => void;
  onStateChange: (value: string | null) => void;
  onCityChange: (value: string) => void;
  onBimFileChange?: (files: FileList | null) => void;
  bimFile?: File;
  showBim?: boolean;
}

function LocationStep({
  country,
  state,
  city,
  onCountryChange,
  onStateChange,
  onCityChange,
  onBimFileChange,
  bimFile,
  showBim = true,
}: LocationStepProps) {
  const countryId = useId();
  return (
    <div className="mx-auto w-full max-w-2xl">
      <h2 className="text-center text-2xl font-medium text-ink text-balance">
        Project Location
      </h2>
      <p className="mt-2 text-center text-sm text-ink-muted text-pretty">
        Where will this project take place?
      </p>

      <div className="mt-8 space-y-8">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor={countryId}>Country</Label>
            <SearchableSelect
              id={countryId}
              className="text-base lg:text-sm"
              items={COUNTRY_NAMES}
              value={country}
              onChange={onCountryChange}
              placeholder="Select country"
              searchPlaceholder="Search countries…"
              emptyText="No countries found."
            />
          </div>
          <FormField
            label="State, Region or Province"
            helperText="Optional, if applicable."
            className="h-11"
            placeholder="Enter state, region or province"
            autoComplete="address-level1"
            maxLength={100}
            value={state ?? ""}
            onChange={(e) => onStateChange(e.target.value)}
          />
          <FormField
            label="City or Area"
            className="h-11"
            placeholder="Enter city or area"
            autoComplete="address-level2"
            maxLength={100}
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
          />
        </div>

        {showBim ? <ProjectModelField file={bimFile} onChange={onBimFileChange} /> : null}
      </div>
    </div>
  );
}

LocationStep.displayName = "LocationStep";

export { LocationStep, type LocationStepProps };
