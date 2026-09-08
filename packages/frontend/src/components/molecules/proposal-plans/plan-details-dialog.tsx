import { useEffect, useState } from "react";
import { FormDialog } from "@/components/molecules/form-dialog";
import { FileUpload } from "@/components/atoms/file-upload";
import { Input } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { PLAN_DISCIPLINES, type PlanDiscipline, type ProposalPlan, type UpdatePlanInput } from "@/api/proposals";
import { PLAN_DISCIPLINE_LABEL } from "@/lib/precon-meta";
import { cn } from "@/lib/utils";

export type PlanDetailsMode = "details" | "revision";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: PlanDetailsMode;
  plan: ProposalPlan | null;
  submitting: boolean;
  error: string | null;
  onSaveDetails: (planId: string, input: UpdatePlanInput) => void;
  onUploadRevision: (plan: ProposalPlan, file: File, input: { sheetCode: string; revision: string; discipline: PlanDiscipline | null }) => void;
}

const selectClass = cn(
  "flex h-11 w-full rounded-lg bg-[#F6F6F6] px-4 text-sm text-gray-900",
  "border-0 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
);

// A sheet code is what ties revisions of the same drawing together. A new
// revision keeps the code and discipline and bumps the label; the previous
// current revision is superseded server-side, never deleted.
export function PlanDetailsDialog({ open, onOpenChange, mode, plan, submitting, error, onSaveDetails, onUploadRevision }: Props) {
  const [sheetCode, setSheetCode] = useState("");
  const [discipline, setDiscipline] = useState<PlanDiscipline | "">("");
  const [revision, setRevision] = useState("");
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open || !plan) return;
    setSheetCode(plan.sheetCode ?? "");
    setDiscipline(plan.discipline ?? "");
    setRevision(mode === "revision" ? "" : (plan.revision ?? ""));
    setLabel(plan.label ?? "");
    setFile(null);
  }, [open, plan, mode]);

  const isRevision = mode === "revision";
  const canSubmit = isRevision ? Boolean(file) && sheetCode.trim().length > 0 && revision.trim().length > 0 : true;

  function submit() {
    if (!plan) return;
    if (isRevision) {
      if (!file) return;
      onUploadRevision(plan, file, {
        sheetCode: sheetCode.trim(),
        revision: revision.trim(),
        discipline: discipline || null,
      });
      return;
    }
    onSaveDetails(plan.id, {
      sheetCode: sheetCode.trim() || null,
      discipline: discipline || null,
      revision: revision.trim() || null,
      label: label.trim() || null,
    });
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isRevision ? `New revision of ${plan?.fileName ?? "drawing"}` : "Drawing details"}
      description={
        isRevision
          ? "The current revision is kept and marked superseded. Take-offs measured on it stay linked to it."
          : "Sheet code, discipline and revision label. Drawings with the same sheet code form one revision history."
      }
      submitLabel={isRevision ? "Upload revision" : "Save details"}
      submitting={submitting}
      submitDisabled={!canSubmit}
      error={error}
      onSubmit={submit}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="plan-sheet-code">Sheet code</Label>
          <Input id="plan-sheet-code" value={sheetCode} onChange={(e) => setSheetCode(e.target.value)} placeholder="A-101" disabled={isRevision && Boolean(plan?.sheetCode)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="plan-revision">Revision</Label>
          <Input id="plan-revision" value={revision} onChange={(e) => setRevision(e.target.value)} placeholder={isRevision ? "C" : "B"} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="plan-discipline">Discipline</Label>
        <select id="plan-discipline" className={selectClass} value={discipline} onChange={(e) => setDiscipline(e.target.value as PlanDiscipline | "")}>
          <option value="">Not set</option>
          {PLAN_DISCIPLINES.map((d) => (
            <option key={d} value={d}>
              {PLAN_DISCIPLINE_LABEL[d]}
            </option>
          ))}
        </select>
      </div>
      {isRevision ? (
        <FileUpload
          label="Revised drawing"
          height={120}
          accept=".dwg,.pdf,.png,.jpg,.jpeg,.webp"
          hint={file ? file.name : "PDF or DWG"}
          onChange={(files) => setFile(files?.[0] ?? null)}
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="plan-label">Label</Label>
          <Input id="plan-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ground floor plan" />
        </div>
      )}
    </FormDialog>
  );
}
PlanDetailsDialog.displayName = "PlanDetailsDialog";
