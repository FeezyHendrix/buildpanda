import { RadioCard } from "@/components/atoms/radio-card";
import { JOB_PROFILES, type JobProfile } from "@/api/proposals";
import { JOB_PROFILE_META } from "@/lib/precon-meta";

interface Props {
  value: JobProfile;
  onChange: (value: JobProfile) => void;
  disabled?: boolean;
}

// Chosen when the proposal is created. It shapes the take-off scopes offered,
// what the estimate prices, what the client receives and who owns material
// orders at handoff, so it is a first-class choice rather than a setting.
export function JobProfilePicker({ value, onChange, disabled = false }: Props) {
  return (
    <div className="flex flex-col gap-2" role="radiogroup" aria-label="Job profile">
      {JOB_PROFILES.map((profile) => (
        <RadioCard
          key={profile}
          title={JOB_PROFILE_META[profile].label}
          description={JOB_PROFILE_META[profile].description}
          selected={value === profile}
          disabled={disabled}
          onClick={() => onChange(profile)}
          className="p-4"
        />
      ))}
    </div>
  );
}
JobProfilePicker.displayName = "JobProfilePicker";
