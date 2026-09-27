import { useState } from "react";
import type { InspectionFields } from "@/api/inspections";
import { useDraftState } from "./use-draft-state";

interface InspectionDraft {
  title: string;
  category: string;
  description: string;
  scheduledAt: string;
  activityId: string | null;
  location: string;
  holdPoint: boolean;
  contractorName: string | null;
  feeAmount: string;
}

export function useInspectionDraft(projectId: string, inspectionId?: string, initial?: InspectionFields) {
  const [base] = useState<InspectionDraft>(() => ({
    title: initial?.title ?? "",
    category: initial?.category ?? "",
    description: initial?.description ?? "",
    scheduledAt: initial?.scheduledAt.slice(0, 10) ?? "",
    activityId: initial?.activityId ?? null,
    location: initial?.location ?? "",
    holdPoint: initial?.holdPoint ?? false,
    contractorName: initial?.contractorName ?? (initial ? "" : null),
    feeAmount: initial?.feeAmount != null ? String(initial.feeAmount) : "",
  }));
  const [saved, setSaved, clear] = useDraftState<InspectionDraft | null>(
    `inspection:${projectId}:${inspectionId ?? "new"}`, null,
  );

  function setField<K extends keyof InspectionDraft>(key: K, value: InspectionDraft[K]) {
    setSaved(previous => {
      const current = previous ?? base;
      return Object.is(current[key], value) ? previous : { ...current, [key]: value };
    });
  }

  return { values: saved ?? base, dirty: saved !== null, setField, clear };
}
