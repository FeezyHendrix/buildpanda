import { useEffect, useState } from "react";
import { FormDrawer } from "./form-drawer";
import { Label } from "@/components/atoms/label";
import { MoneyInput } from "@/components/atoms/money-input";
import { currencySymbol } from "@/lib/formatters";
import type {
  MilestonePayment,
  MilestoneStatus,
  ProjectPhase,
  SignOffStatus,
} from "@/lib/project-types";

export interface UpsertMilestoneValues {
  name: string;
  phase: string;
  amount: number;
  percentComplete: number;
  status: MilestoneStatus;
  inspectorSignOff: SignOffStatus;
}

interface UpsertMilestoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phases: ProjectPhase[];
  initial?: MilestonePayment | null;
  onSubmit: (values: UpsertMilestoneValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
  currency?: string;
}

function UpsertMilestoneDialog({
  open,
  onOpenChange,
  phases,
  initial,
  onSubmit,
  isSubmitting = false,
  error,
  currency = "USD",
}: UpsertMilestoneDialogProps) {
  const fallbackPhase = phases[0]?.name ?? "";
  const symbol = currencySymbol(currency);
  const [name, setName] = useState("");
  const [phase, setPhase] = useState(fallbackPhase);
  const [amount, setAmount] = useState("0");
  const [percentComplete, setPercentComplete] = useState("0");
  const [status, setStatus] = useState<MilestoneStatus>("Pending");
  const [inspectorSignOff, setInspectorSignOff] = useState<SignOffStatus>("Pending");

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setPhase(initial?.phase ?? fallbackPhase);
    setAmount(String(initial?.amount ?? 0));
    setPercentComplete(String(initial?.percentComplete ?? 0));
    setStatus(initial?.status ?? "Pending");
    setInspectorSignOff(initial?.inspectorSignOff ?? "Pending");
  }, [fallbackPhase, initial, open]);

  const isValid =
    name.trim().length > 0 &&
    phase.trim().length > 0 &&
    Number(amount) >= 0 &&
    Number(percentComplete) >= 0 &&
    Number(percentComplete) <= 100;

  function handleSubmit(): void {
    if (!isValid) return;
    onSubmit({
      name: name.trim(),
      phase: phase.trim(),
      amount: Math.max(0, Number(amount) || 0),
      percentComplete: Math.min(100, Math.max(0, Number(percentComplete) || 0)),
      status,
      inspectorSignOff,
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={initial ? "Edit milestone" : "New milestone"}
      description="Create a cost gate that owns schedule work items and rolls into the project report."
      submitLabel={initial ? "Save milestone" : "Create milestone"}
      submitDisabled={!isValid}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="milestone-name">Name</Label>
        <input
          id="milestone-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Superstructure payment"
          maxLength={200}
          autoFocus
          className="h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="milestone-phase">Schedule phase</Label>
        <select
          id="milestone-phase"
          value={phase}
          onChange={(event) => setPhase(event.target.value)}
          className="h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
        >
          {phases.map((p) => (
            <option key={p.id} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="milestone-amount">Amount</Label>
          <MoneyInput
            id="milestone-amount"
            value={amount}
            onChange={setAmount}
            currencySymbol={symbol}
            placeholder="0.00"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="milestone-progress">Progress %</Label>
          <input
            id="milestone-progress"
            type="number"
            min="0"
            max="100"
            value={percentComplete}
            onChange={(event) => setPercentComplete(event.target.value)}
            className="h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="milestone-status">Status</Label>
          <select
            id="milestone-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as MilestoneStatus)}
            className="h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
          >
            <option value="Pending">Pending</option>
            <option value="InProgress">In progress</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="milestone-signoff">Inspector sign-off</Label>
          <select
            id="milestone-signoff"
            value={inspectorSignOff}
            onChange={(event) => setInspectorSignOff(event.target.value as SignOffStatus)}
            className="h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
          >
            <option value="Pending">Pending</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Verified">Verified</option>
          </select>
        </div>
      </div>
    </FormDrawer>
  );
}

export { UpsertMilestoneDialog };
