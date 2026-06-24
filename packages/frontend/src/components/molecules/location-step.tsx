import { FormField } from "@/components/molecules/form-field";
import { Label } from "@/components/atoms/label";
import {
  MapPlaceholder,
  SearchableSelect,
  FileUpload,
} from "@/components/atoms";
import { nigerianStates } from "@/lib/nigerian-states";

interface LocationStepProps {
  state: string | null;
  city: string;
  onStateChange: (value: string | null) => void;
  onCityChange: (value: string) => void;
  onBimFileChange?: (files: FileList | null) => void;
}

function LocationStep({
  state,
  city,
  onStateChange,
  onCityChange,
  onBimFileChange,
}: LocationStepProps) {
  return (
    <div>
      <h2 className="text-center text-[25px] font-bold text-gray-900 text-balance">
        Project Location
      </h2>
      <p className="mt-2 text-center text-sm text-[#929292] text-pretty">
        Tell us where your next dream project is located.
      </p>

      <div className="mt-8 space-y-6">
        <div className="grid grid-cols-2 gap-5">
          <div className="flex flex-col gap-1.5">
            <Label>State in Nigeria</Label>
            <SearchableSelect
              items={nigerianStates}
              value={state}
              onChange={onStateChange}
              placeholder="Select state"
              searchPlaceholder="Search states…"
              emptyText="No states found."
            />
          </div>
          <FormField
            label="City or Area"
            placeholder="Enter city or area"
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
          />
        </div>

        <MapPlaceholder />

        <div>
          <p className="text-sm font-semibold text-gray-900">
            Do you have a 3D model (BIM)?
          </p>
          <p className="mt-1 text-xs text-[#929292] text-pretty">
            If you have an IFC model from your architect, upload it to view it in 3D and link RFIs to elements.
          </p>
          <FileUpload
            label="Upload IFC model"
            optional
            accept=".ifc"
            height={200}
            onChange={onBimFileChange}
          />
        </div>
      </div>
    </div>
  );
}

LocationStep.displayName = "LocationStep";

export { LocationStep, type LocationStepProps };
