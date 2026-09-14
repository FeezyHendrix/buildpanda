import { useDraftState } from "@/hooks/use-draft-state";
import { useProjectProfile, useUpdateProjectProfile } from "@/hooks/use-projects";
import type { ProjectProfile } from "@/api/projects";

export type ProfileDraft = Omit<ProjectProfile, "aiUpdateCadence">;
const EMPTY_CHANGES: Partial<ProfileDraft> = {};

function toDraft(profile: ProjectProfile): ProfileDraft {
  return {
    name: profile.name,
    address: profile.address,
    startDate: profile.startDate,
    completionDate: profile.completionDate,
    revisedCompletionDate: profile.revisedCompletionDate,
    clientName: profile.clientName,
    contractorEntity: profile.contractorEntity,
    projectType: profile.projectType,
    workingDays: profile.workingDays,
    holidays: profile.holidays,
  };
}

/**
 * One draft of the project profile, shared by the General and Programme tabs.
 * Each tab saves only the fields it owns, so switching tabs never carries a
 * half-finished edit from one card into another card's PATCH.
 */
export function useProfileDraft(projectId: string) {
  const query = useProjectProfile(projectId);
  const save = useUpdateProjectProfile(projectId);
  const [changes, setChanges] = useDraftState(`project-profile:${projectId}`, EMPTY_CHANGES);
  const draft = query.data ? { ...toDraft(query.data), ...changes } : null;

  function update<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]): void {
    setChanges((previous) => {
      if (JSON.stringify(value) === JSON.stringify(draft?.[key])) return previous;
      const next = { ...previous, [key]: value };
      if (JSON.stringify(value) === JSON.stringify(query.data?.[key])) delete next[key];
      return next;
    });
  }

  /** True when any of `keys` differs from what the server last returned. */
  function isDirty(keys: readonly (keyof ProfileDraft)[]): boolean {
    if (!draft || !query.data) return false;
    const saved = toDraft(query.data);
    return keys.some((key) => JSON.stringify(draft[key]) !== JSON.stringify(saved[key]));
  }

  function saveFields(keys: readonly (keyof ProfileDraft)[], onDone: () => void): void {
    if (!draft || save.isPending) return;
    const patch: Partial<ProfileDraft> = {};
    for (const key of keys) {
      if (isDirty([key])) patch[key] = draft[key] as never;
    }
    if (!Object.keys(patch).length) return;
    save.mutate(patch, { onSuccess: () => {
      setChanges((previous) => {
        const next = { ...previous };
        for (const key of keys) {
          if (JSON.stringify(next[key]) === JSON.stringify(patch[key])) delete next[key];
        }
        return next;
      });
      onDone();
    } });
  }

  return { draft, isPending: query.isPending, error: query.error, refetch: query.refetch, save, update, isDirty, saveFields };
}
