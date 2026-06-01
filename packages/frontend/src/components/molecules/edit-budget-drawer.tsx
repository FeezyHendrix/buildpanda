import { useState } from "react";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { BudgetSlider } from "@/components/atoms";
import type { Project } from "@/lib/project-mock-data";
import { useUpdateProjectBudget } from "@/hooks/use-projects";

const SLIDER_MAX = 10_000_000_000;
const DEFAULT_MIN = 10_000_000;
const DEFAULT_MAX = 50_000_000;

interface EditBudgetDrawerProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function initialRange(project: Project): [number, number] {
  const max = project.budgetMax ?? project.budgetTotal ?? DEFAULT_MAX;
  const min = project.budgetMin ?? Math.min(DEFAULT_MIN, max);
  return [min, max];
}

function EditBudgetDrawer({ project, open, onOpenChange }: EditBudgetDrawerProps) {
  const updateBudget = useUpdateProjectBudget(project.id);
  const [budget, setBudget] = useState<[number, number]>(() => initialRange(project));
  const [custom, setCustom] = useState(
    () => budget[0] > SLIDER_MAX || budget[1] > SLIDER_MAX,
  );

  function setBudgetField(index: 0 | 1, raw: string): void {
    const amount = Math.max(0, Math.round(Number(raw.replace(/[^0-9.]/g, "")) || 0));
    setBudget(index === 0 ? [amount, budget[1]] : [budget[0], amount]);
  }

  const invalid = budget[1] < budget[0] || budget[1] <= 0;

  async function handleSubmit(): Promise<void> {
    await updateBudget.mutateAsync({
      budgetMin: budget[0],
      budgetMax: budget[1],
      currency: project.currency,
    });
    onOpenChange(false);
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Edit budget"
      description="Adjust the estimated budget range for this project."
      submitLabel="Save budget"
      submitDisabled={invalid}
      submitting={updateBudget.isPending}
      error={updateBudget.isError ? "Could not update the budget. Please try again." : null}
      onSubmit={handleSubmit}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900">Estimated budget</span>
        <button
          type="button"
          onClick={() => setCustom((c) => !c)}
          className="text-sm font-medium text-[#004DE7] hover:text-[#0041c4]"
        >
          {custom ? "Use the slider" : "Enter a custom amount"}
        </button>
      </div>

      {custom ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <CustomBudgetInput
            label="Minimum"
            currency={project.currency}
            value={budget[0]}
            onChange={(raw) => setBudgetField(0, raw)}
          />
          <CustomBudgetInput
            label="Maximum"
            currency={project.currency}
            value={budget[1]}
            onChange={(raw) => setBudgetField(1, raw)}
          />
        </div>
      ) : (
        <BudgetSlider value={budget} onChange={setBudget} currency={project.currency} />
      )}

      {invalid && (
        <p className="text-xs text-[#C72525]">
          Maximum budget should be greater than the minimum.
        </p>
      )}
    </FormDrawer>
  );
}

function CustomBudgetInput({
  label,
  currency,
  value,
  onChange,
}: {
  label: string;
  currency: string;
  value: number;
  onChange: (raw: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-gray-900">{label}</span>
      <div className="flex h-12 items-center rounded-lg border border-[#EDEDED] bg-white px-3 focus-within:ring-2 focus-within:ring-gray-900/10">
        <span className="mr-2 shrink-0 text-sm font-medium text-gray-500">{currency}</span>
        <input
          type="text"
          inputMode="numeric"
          value={value ? value.toLocaleString("en-US") : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className="w-full bg-transparent text-sm text-gray-900 outline-none"
        />
      </div>
    </label>
  );
}

EditBudgetDrawer.displayName = "EditBudgetDrawer";

export { EditBudgetDrawer };
