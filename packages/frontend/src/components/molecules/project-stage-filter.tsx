import { useId } from "react";
import { ComboSelect } from "@/components/molecules/combo-select";
import { Spinner } from "@/components/atoms/spinner";
import { useStageScope } from "@/contexts/stage-scope-context";

const ALL_STAGES = "__all_stages__";

export function ProjectStageFilter() {
  const id = useId();
  const { stages, selectedStageId, setSelectedStageId, canFilterStages, isLoading } = useStageScope();
  if (!canFilterStages) return null;
  if (isLoading) return <Spinner size="sm" />;

  return (
    <div className="flex w-full items-center gap-2 sm:w-72">
      <label htmlFor={id} className="shrink-0 text-xs font-medium text-ink-muted">Build stage</label>
      <ComboSelect
        id={id}
        items={[
          { id: ALL_STAGES, label: "All build stages" },
          ...stages.map((stage) => ({ id: stage.id, label: stage.name })),
        ]}
        value={selectedStageId ?? ALL_STAGES}
        onChange={(value) => setSelectedStageId(value && value !== ALL_STAGES ? value : undefined)}
        searchPlaceholder="Search build stages"
        className="min-w-0 flex-1"
      />
    </div>
  );
}

ProjectStageFilter.displayName = "ProjectStageFilter";
