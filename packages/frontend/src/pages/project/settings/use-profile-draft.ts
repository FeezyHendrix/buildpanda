import { useEffect, useState } from "react";
import { useProjectProfile, useUpdateProjectProfile } from "@/hooks/use-projects";
import type { ProjectProfile } from "@/api/projects";

export type ProfileDraft = Omit<ProjectProfile, "aiUpdateCadence">;

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
  const [draft, setDraft] = useState<ProfileDraft | null>(null);

  useEffect(() => {
    if (query.data) setDraft(toDraft(query.data));
  }, [query.data]);

  function update<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]): void {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  /** True when any of `keys` differs from what the server last returned. */
  function isDirty(keys: readonly (keyof ProfileDraft)[]): boolean {
    if (!draft || !query.data) return false;
    const saved = toDraft(query.data);
    return keys.some((key) => JSON.stringify(draft[key]) !== JSON.stringify(saved[key]));
  }

  function saveFields(keys: readonly (keyof ProfileDraft)[], onDone: () => void): void {
    if (!draft) return;
    const patch: Partial<ProfileDraft> = {};
    for (const key of keys) patch[key] = draft[key] as never;
    save.mutate(patch, { onSuccess: onDone });
  }

  return { draft, isPending: query.isPending, save, update, isDirty, saveFields };
}
