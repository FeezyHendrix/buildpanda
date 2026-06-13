import { useEffect, useState } from "react";
import { FormDrawer } from "./form-drawer";
import { Label } from "@/components/atoms/label";
import type { DelayReason } from "@/lib/project-types";

export interface RaiseDelayValues {
  reasonCode: string;
  description: string;
  startedAt: string;
  costImpact: number;
  preventionNotes: string;
}

interface RaiseDelayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityName: string;
  reasons: DelayReason[];
  onSubmit: (values: RaiseDelayValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

function toLocalInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function RaiseDelayDialog({
  open,
  onOpenChange,
  activityName,
  reasons,
  onSubmit,
  isSubmitting = false,
  error,
}: RaiseDelayDialogProps) {
  const [reasonCode, setReasonCode] = useState("");
  const [description, setDescription] = useState("");
  const [startedAt, setStartedAt] = useState(toLocalInput(new Date()));
  const [costImpact, setCostImpact] = useState("0");
  const [preventionNotes, setPreventionNotes] = useState("");

  useEffect(() => {
    if (!open) {
      setReasonCode("");
      setDescription("");
      setStartedAt(toLocalInput(new Date()));
      setCostImpact("0");
      setPreventionNotes("");
    }
  }, [open]);

  const isValid = reasonCode.length > 0 && startedAt.length > 0;

  function handleSubmit(): void {
    if (!isValid) return;
    onSubmit({
      reasonCode,
      description: description.trim(),
      startedAt: new Date(startedAt).toISOString(),
      costImpact: Math.max(0, Number(costImpact) || 0),
      preventionNotes: preventionNotes.trim(),
    });
  }

  const grouped = reasons.reduce<Record<string, DelayReason[]>>((acc, r) => {
    const list = acc[r.category] ?? [];
    list.push(r);
    acc[r.category] = list;
    return acc;
  }, {});

  return (
    <FormDrawer open={open}
    onOpenChange={onOpenChange}
    title={`Log a delay on ${activityName}`}
    description="Capture what slowed work down so it's auditable and preventable next time."
    submitLabel="Log delay"
    submitDisabled={!isValid}
    submitting={isSubmitting}
    error={error ?? null}
    onSubmit={handleSubmit}><div className="flex flex-col gap-1.5">
      <Label htmlFor="delay-reason">Reason</Label>
      <select
        id="delay-reason"
        value={reasonCode}
        onChange={(e) => setReasonCode(e.target.value)}
        className="h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
      >
        <option value="">Select a reason…</option>
        {Object.entries(grouped).map(([category, list]) => (
          <optgroup key={category} label={category}>
            {list.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
    
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="delay-started">Started at</Label>
      <input
        id="delay-started"
        type="datetime-local"
        value={startedAt}
        onChange={(e) => setStartedAt(e.target.value)}
        className="h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
      />
    </div>
    
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="delay-description">What happened?</Label>
      <textarea
        id="delay-description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        maxLength={2000}
        placeholder="Brief description of the situation."
        className="resize-none rounded-lg bg-[#F6F6F6] px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10"
      />
    </div>
    
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="delay-cost">Estimated cost impact (NGN)</Label>
      <input
        id="delay-cost"
        type="number"
        min={0}
        value={costImpact}
        onChange={(e) => setCostImpact(e.target.value)}
        className="h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
      />
    </div>
    
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="delay-prevention">How can we prevent this?</Label>
      <textarea
        id="delay-prevention"
        value={preventionNotes}
        onChange={(e) => setPreventionNotes(e.target.value)}
        rows={2}
        maxLength={2000}
        placeholder="Optional — fill once known."
        className="resize-none rounded-lg bg-[#F6F6F6] px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10"
      />
    </div></FormDrawer>
  );
}

RaiseDelayDialog.displayName = "RaiseDelayDialog";

export { RaiseDelayDialog, type RaiseDelayDialogProps };
