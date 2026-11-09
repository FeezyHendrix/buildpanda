import { INPUT_CLASS } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { Select } from "@/components/atoms/select";
import { Spinner } from "@/components/atoms/spinner";
import { PROJECT_TYPE_CODES, type ProjectTypeCode } from "@/api/projects";
import { toast } from "@/lib/toast";
import { FIELD_LABEL_CLASS, SaveRow, SettingsCard } from "./settings-tabs";
import type { useProfileDraft } from "./use-profile-draft";

const TYPE_LABEL: Record<ProjectTypeCode, string> = {
  building: "Building — new build",
  renovation: "Renovation / fit-out",
  civil: "Civil / infrastructure (roads, drainage, bridges)",
  other: "Other",
};

const PROJECT_TYPE_OPTIONS = [
  { value: "", label: "Not set" },
  ...PROJECT_TYPE_CODES.map((code) => ({ value: code, label: TYPE_LABEL[code] })),
];

const FIELDS = ["name", "address", "clientName", "contractorEntity", "projectType"] as const;

interface GeneralTabProps {
  canManage: boolean;
  profile: ReturnType<typeof useProfileDraft>;
}

/** Who this job is and who the parties are. */
function GeneralTab({ canManage, profile }: GeneralTabProps) {
  const { draft, isPending, save, update, isDirty, saveFields } = profile;

  if (isPending || !draft) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <SettingsCard
      title="Project & parties"
      description="The name the team sees, where the work is, and who the contract is between."
    >
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="profile-name" className={FIELD_LABEL_CLASS}>Project name</Label>
          <input
            id="profile-name"
            value={draft.name}
            disabled={!canManage}
            maxLength={200}
            onChange={(event) => update("name", event.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="profile-type" className={FIELD_LABEL_CLASS}>Project type</Label>
          <Select
            id="profile-type"
            options={PROJECT_TYPE_OPTIONS}
            value={draft.projectType ?? ""}
            disabled={!canManage}
            placeholder="Not set"
            className="h-[45px] px-4 text-caption-l!"
            onChange={(next) => update("projectType", (next || null) as ProjectTypeCode | null)}
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="profile-address" className={FIELD_LABEL_CLASS}>Site address</Label>
          <input
            id="profile-address"
            value={draft.address}
            disabled={!canManage}
            maxLength={300}
            placeholder="Site address, city or region, and country"
            onChange={(event) => update("address", event.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="profile-client" className={FIELD_LABEL_CLASS}>Client / employer</Label>
          <input
            id="profile-client"
            value={draft.clientName ?? ""}
            disabled={!canManage}
            maxLength={200}
            placeholder="Client or employer name"
            onChange={(event) => update("clientName", event.target.value || null)}
            className={INPUT_CLASS}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="profile-contractor" className={FIELD_LABEL_CLASS}>Contractor legal entity</Label>
          <input
            id="profile-contractor"
            value={draft.contractorEntity ?? ""}
            disabled={!canManage}
            maxLength={200}
            onChange={(event) => update("contractorEntity", event.target.value || null)}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      {canManage ? (
        <SaveRow
          draftNotice
          dirty={isDirty(FIELDS)}
          loading={save.isPending}
          error={save.error}
          onSave={() => saveFields(FIELDS, () => toast("Project details saved", "success"))}
        />
      ) : null}
    </SettingsCard>
  );
}

GeneralTab.displayName = "GeneralTab";

export { GeneralTab, type GeneralTabProps };
