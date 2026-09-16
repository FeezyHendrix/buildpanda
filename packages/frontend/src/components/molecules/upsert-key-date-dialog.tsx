import { useEffect, useState } from "react";
import { FormDrawer } from "./form-drawer";
import { Select, type SelectOption } from "@/components/atoms/select";
import { TextArea } from "@/components/atoms/text-area";
import { TextInput } from "@/components/atoms/text-input";
import type { KeyDateStatus } from "@/lib/project-types";

export interface UpsertKeyDateValues {
  label: string;
  targetDate: string | null;
  actualDate: string | null;
  status: KeyDateStatus;
  notes: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: Partial<UpsertKeyDateValues>;
  onSubmit: (values: UpsertKeyDateValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

const STATUS_OPTIONS: SelectOption[] = [
  { value: "Upcoming", label: "Upcoming" },
  { value: "Met", label: "Met" },
  { value: "Missed", label: "Missed" },
];

function UpsertKeyDateDialog({ open, onOpenChange, mode, initial, onSubmit, isSubmitting = false, error }: Props) {
  const [label, setLabel] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [actualDate, setActualDate] = useState("");
  const [status, setStatus] = useState<KeyDateStatus>("Upcoming");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setLabel(initial?.label ?? "");
      setTargetDate(initial?.targetDate ?? "");
      setActualDate(initial?.actualDate ?? "");
      setStatus(initial?.status ?? "Upcoming");
      setNotes(initial?.notes ?? "");
    }
  }, [open, initial]);

  function handleSubmit(): void {
    if (!label.trim()) return;
    onSubmit({
      label: label.trim(),
      targetDate: targetDate || null,
      actualDate: actualDate || null,
      status,
      notes: notes.trim() || null,
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? "Add Key Date" : "Edit Key Date"}
      description="Record an important project date, such as a milestone, inspection, payment due date, or handover, so your team stays on schedule."
      submitLabel={mode === "create" ? "Create Stage" : "Save Changes"}
      submitDisabled={!label.trim()}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
      footerVariant="stacked"
    >
      <TextInput label="Label" value={label} onChange={setLabel} placeholder="" />

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="kd-target" className="text-[13px] font-medium leading-none text-[#1E1E1E]">
            Start date
          </label>
          <input
            id="kd-target"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            placeholder="DD/MM/YY"
            className="h-11 w-full border border-[#EBEBEB] bg-white px-3.5 text-[14px] text-[#1E1E1E] placeholder:text-[#B0B0B0] outline-none focus:border-[#004DE7] focus:ring-1 focus:ring-[#004DE7]/10"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="kd-actual" className="text-[13px] font-medium leading-none text-[#1E1E1E]">
            Target end date
          </label>
          <input
            id="kd-actual"
            type="date"
            value={actualDate}
            onChange={(e) => setActualDate(e.target.value)}
            placeholder="DD/MM/YY"
            className="h-11 w-full border border-[#EBEBEB] bg-white px-3.5 text-[14px] text-[#1E1E1E] placeholder:text-[#B0B0B0] outline-none focus:border-[#004DE7] focus:ring-1 focus:ring-[#004DE7]/10"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium leading-none text-[#1E1E1E]">Status</label>
        <Select
          options={STATUS_OPTIONS}
          value={status}
          onChange={(v) => v && setStatus(v as KeyDateStatus)}
          placeholder="Select Phase"
        />
      </div>

      <TextArea
        label="Notes"
        placeholder="Describe what happened on site."
        value={notes}
        onChange={setNotes}
        rows={8}
      />
    </FormDrawer>
  );
}

UpsertKeyDateDialog.displayName = "UpsertKeyDateDialog";

export { UpsertKeyDateDialog };
