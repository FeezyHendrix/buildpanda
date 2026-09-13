import { INPUT_CLASS } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { Spinner } from "@/components/atoms/spinner";
import { PROJECT_TYPE_CODES, type ProjectTypeCode } from "@/api/projects";
import { toast } from "@/lib/toast";
import { SaveRow, SettingsCard } from "./settings-tabs";
import type { useProfileDraft } from "./use-profile-draft";

const TYPE_LABEL: Record<ProjectTypeCode, string> = {
  building: "Building — new build",
  renovation: "Renovation / fit-out",
  civil: "Civil / infrastructure (roads, drainage, bridges)",
  other: "Other",
};

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
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="profile-name">Project name</Label>
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
          <Label htmlFor="profile-type">Project type</Label>
          <select
            id="profile-type"
            value={draft.projectType ?? ""}
            disabled={!canManage}
            onChange={(event) =>
              update("projectType", (event.target.value || null) as ProjectTypeCode | null)
            }
            className={INPUT_CLASS}
          >
            <option value="">Not set</option>
            {PROJECT_TYPE_CODES.map((code) => (
              <option key={code} value={code}>
                {TYPE_LABEL[code]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="profile-address">Site address</Label>
          <input
            id="profile-address"
            value={draft.address}
            disabled={!canManage}
            maxLength={300}
            placeholder="e.g. Km 14 Ikorodu–Sagamu Road, Odogunyan, Ikorodu, Lagos"
            onChange={(event) => update("address", event.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="profile-client">Client / employer</Label>
          <input
            id="profile-client"
            value={draft.clientName ?? ""}
            disabled={!canManage}
            maxLength={200}
            placeholder="e.g. Lagos State Ministry of Works"
            onChange={(event) => update("clientName", event.target.value || null)}
            className={INPUT_CLASS}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="profile-contractor">Contractor legal entity</Label>
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
