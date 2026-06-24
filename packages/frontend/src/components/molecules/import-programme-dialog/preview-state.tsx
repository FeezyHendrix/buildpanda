import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { CurrencyPicker } from "@/components/atoms/currency-picker";
import { MoneyInput } from "@/components/atoms/money-input";
import { Badge } from "@/components/atoms/badge";
import { CURRENCY_CODES } from "@/lib/currency";
import type { StructuredProgramme } from "@/hooks/use-programme-import";
import { PhasePreview } from "./phase-preview";

const CURRENCY_CHOICES = CURRENCY_CODES.slice(0, 5);

export function PreviewState({
  result,
  projectId,
  isApplying,
  applyError,
  onApply,
}: {
  result: StructuredProgramme;
  projectId?: string;
  isApplying: boolean;
  applyError: string | null;
  onApply: (data: {
    projectName?: string;
    city?: string;
    state?: string;
    budgetTotal?: number;
    currency?: string;
  }) => void;
}) {
  const [projectName, setProjectName] = useState(result.projectName || "");
  const [city, setCity] = useState("");
  const [locationState, setLocationState] = useState("");
  const [budgetTotal, setBudgetTotal] = useState("");
  const [currency, setCurrency] = useState("NGN");

  const intoExisting = Boolean(projectId);
  const milestoneCount = result.activities.filter((a) => a.isMilestone).length;
  const canSubmit = intoExisting || (projectName.trim() && city.trim() && locationState.trim());

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    if (intoExisting) {
      onApply({});
      return;
    }
    onApply({
      projectName: projectName.trim(),
      city: city.trim(),
      state: locationState.trim(),
      budgetTotal: Number(budgetTotal.replace(/[^0-9.]/g, "")) || 0,
      currency,
    });
  }

  const inputClass =
    "h-10 w-full rounded-lg border border-[#EDEDED] bg-white px-3 text-sm text-gray-900 outline-none focus:border-[#004DE7] focus:ring-1 focus:ring-[#004DE7]";

  return (
    <form onSubmit={submit} className="space-y-6">
      {intoExisting ? (
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">Import schedule</h3>
          <Badge tone="neutral" size="md">
            {result.phases.length} phases · {result.activities.length} activities
            {milestoneCount > 0 ? ` · ${milestoneCount} milestones` : ""}
          </Badge>
          {result.usedAi ? (
            <Badge tone="info" size="md">
              Panda AI
            </Badge>
          ) : null}
        </div>
      ) : (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">Project details</h3>
            <Badge tone="neutral" size="md">
              {result.phases.length} phases · {result.activities.length} activities
              {milestoneCount > 0 ? ` · ${milestoneCount} milestones` : ""}
            </Badge>
            {result.usedAi ? (
              <Badge tone="info" size="md">
                Panda AI
              </Badge>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Project name</span>
              <input
                className={inputClass}
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. Lekki Phase 1 Residential"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Currency</span>
              <CurrencyPicker currencies={CURRENCY_CHOICES} value={currency} onChange={setCurrency} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">City</span>
              <input
                className={inputClass}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Lagos"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">State / Region</span>
              <input
                className={inputClass}
                value={locationState}
                onChange={(e) => setLocationState(e.target.value)}
                placeholder="e.g. Lagos State"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-gray-600">Total budget</span>
              <MoneyInput
                className={inputClass}
                value={budgetTotal}
                onChange={setBudgetTotal}
                placeholder="0"
              />
            </label>
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-900">Parsed schedule preview</h3>
        <div className="max-h-64 space-y-3 overflow-y-auto rounded-xl border border-[#EDEDED] p-3">
          {result.phases.map((phase) => (
            <PhasePreview key={phase.key} phase={phase} activities={result.activities} />
          ))}
        </div>
      </div>

      {applyError && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{applyError}</div>
      )}

      <div className="flex items-center justify-end">
        <Button type="submit" loading={isApplying} disabled={!canSubmit}>
          {intoExisting
              ? "Import into project"
              : "Build project"}
        </Button>
      </div>
    </form>
  );
}

