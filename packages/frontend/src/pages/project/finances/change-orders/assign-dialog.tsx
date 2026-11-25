import { useEffect, useMemo, useState } from "react";
import { SearchableSelect } from "@/components/atoms/searchable-select";
import { DRAWER_LABEL_CLASS } from "@/components/molecules/drawer-fields";
import { FormDrawer } from "@/components/molecules/form-drawer";
import type { ChangeRequest } from "@/lib/project-types";

const UNASSIGNED = "Unassigned";

interface AssignDialogProps {
  change: ChangeRequest | null;
  options: { id: string; name: string }[];
  onClose: () => void;
  onSubmit: (assigneeId: string | null) => void;
  isSubmitting: boolean;
  error: string | null;
}

/** Who is carrying this change order. Assignment never moves the ladder. */
export function AssignDialog({ change, options, onClose, onSubmit, isSubmitting, error }: AssignDialogProps) {
  const [name, setName] = useState(UNASSIGNED);
  const labels = useMemo(() => [UNASSIGNED, ...options.map((option) => option.name)], [options]);

  useEffect(() => {
    if (change) setName(change.assigneeName ?? UNASSIGNED);
  }, [change]);

  return (
    <FormDrawer
      open={change !== null}
      onOpenChange={(next) => !next && onClose()}
      title="Assign change order"
      description={change ? change.title : undefined}
      submitLabel="Save"
      submitting={isSubmitting}
      error={error}
      footerVariant="stacked"
      onSubmit={() => onSubmit(options.find((option) => option.name === name)?.id ?? null)}
    >
      <div className="flex flex-col gap-[5px]">
        <label htmlFor="change-assignee" className={DRAWER_LABEL_CLASS}>
          Assigned to
        </label>
        <SearchableSelect id="change-assignee" items={labels} value={name} onChange={(next) => setName(next ?? UNASSIGNED)} searchPlaceholder="Search people" />
      </div>
    </FormDrawer>
  );
}

AssignDialog.displayName = "AssignDialog";
