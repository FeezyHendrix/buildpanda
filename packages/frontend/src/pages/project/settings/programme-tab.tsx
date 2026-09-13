import { INPUT_CLASS } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { Spinner } from "@/components/atoms/spinner";
import { toast } from "@/lib/toast";
import { SaveRow, SettingsCard } from "./settings-tabs";
import { WorkingCalendarFields } from "./working-calendar-fields";
import type { useProfileDraft } from "./use-profile-draft";

const FIELDS = ["startDate", "completionDate", "workingDays", "holidays"] as const;

interface ProgrammeTabProps {
  canManage: boolean;
  profile: ReturnType<typeof useProfileDraft>;
}

/**
 * The contract dates and the working calendar. Every "working days missed",
 * duration and extension-of-time figure measures against these, and none of
 * them could be stated before (findings #8, #14, #33, F4).
 */
function ProgrammeTab({ canManage, profile }: ProgrammeTabProps) {
  const { draft, isPending, save, update, isDirty, saveFields } = profile;

  if (isPending || !draft) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  const datesInverted = Boolean(
    draft.startDate && draft.completionDate && draft.completionDate < draft.startDate,
  );

  return (
    <SettingsCard
      title="Contract dates & working calendar"
      description="When the job runs and which days the site works. Schedule health, missed days and durations are all measured against these."
    >
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="profile-start">Commencement date</Label>
          <input
            id="profile-start"
            type="date"
            value={draft.startDate ?? ""}
            disabled={!canManage}
            onChange={(event) => update("startDate", event.target.value || null)}
            className={INPUT_CLASS}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="profile-completion">Contract completion date</Label>
          <input
            id="profile-completion"
            type="date"
            value={draft.completionDate ?? ""}
            disabled={!canManage}
            aria-invalid={datesInverted || undefined}
            onChange={(event) => update("completionDate", event.target.value || null)}
            className={INPUT_CLASS}
          />
          {datesInverted ? (
            <p className="text-xs text-negative-600">Completion must not be before commencement.</p>
          ) : null}
        </div>
      </div>

      {draft.revisedCompletionDate ? (
        <p className="mt-3 rounded-lg bg-surface-alt px-3 py-2 text-xs text-gray-600">
          Revised completion is {draft.revisedCompletionDate}. It moves only when an extension of
          time is awarded, never by editing the contract date.
        </p>
      ) : null}

      <WorkingCalendarFields
        workingDays={draft.workingDays}
        holidays={draft.holidays}
        disabled={!canManage}
        onChangeWorkingDays={(days) => update("workingDays", days)}
        onChangeHolidays={(dates) => update("holidays", dates)}
      />

      {canManage ? (
        <SaveRow
          dirty={isDirty(FIELDS)}
          disabled={datesInverted}
          loading={save.isPending}
          error={save.error}
          onSave={() => saveFields(FIELDS, () => toast("Programme settings saved", "success"))}
        />
      ) : null}
    </SettingsCard>
  );
}

ProgrammeTab.displayName = "ProgrammeTab";

export { ProgrammeTab, type ProgrammeTabProps };
