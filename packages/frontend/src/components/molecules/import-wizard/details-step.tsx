import { useState } from "react";
import { useCreateProject } from "@/hooks/use-projects";
import { useLinkSessionProject } from "@/hooks/use-import-session";
import { Button } from "@/components/atoms/button";
import { CurrencyPicker } from "@/components/atoms/currency-picker";
import { MoneyInput } from "@/components/atoms/money-input";
import { Switcher, type SwitcherValue } from "@/components/atoms/switcher";
import { getApiErrorMessage } from "@/lib/api-error";
import type { Currency } from "@/lib/project-types";
import { CURRENCY_CODES } from "@/lib/currency";

const CURRENCY_CHOICES = CURRENCY_CODES.slice(0, 5);

interface DetailsStepProps {
  sessionId: string;
  projectId: string | null;
  onProjectCreated: (id: string) => void;
  onNext: () => void;
}

export function DetailsStep({ sessionId, onProjectCreated, onNext }: Omit<DetailsStepProps, "projectId">) {
  const createProject = useCreateProject();
  const linkSession = useLinkSessionProject();

  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [ownsLand, setOwnsLand] = useState<SwitcherValue>("yes");
  const [currency, setCurrency] = useState<Currency>("NGN");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  
  const [errorMsg, setErrorMsg] = useState("");

  const handleCreate = async () => {
    setErrorMsg("");
    try {
      const minNum = parseFloat(budgetMin) || 0;
      const maxNum = parseFloat(budgetMax) || 0;
      
      const res = await createProject.mutateAsync({
        title,
        projectType: "build",
        location: {
          state: stateName,
          city,
          ownsLand: ownsLand === "yes",
        },
        details: {
          buildingType: "residential",
          currency,
          budgetMin: minNum,
          budgetMax: maxNum,
          timeline: "0-3 months",
          fundingMethod: "self",
        },
        management: {
          involvementLevel: "high",
          riskOptions: [],
        }
      });
      
      onProjectCreated(res.id);
      await linkSession.mutateAsync({ sessionId, projectId: res.id });
      onNext();
    } catch (err) {
      setErrorMsg(getApiErrorMessage(err, "Failed to create project"));
    }
  };

  const isComplete = title && city && stateName && budgetMin && budgetMax;

  return (
    <div className="flex flex-col max-w-2xl mx-auto mt-4 gap-8 pb-12">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Project Details</h2>
        <p className="text-gray-500">Provide the basic details to set up your project workspace.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <label className="flex flex-col gap-1.5 md:col-span-2">
          <span className="text-sm font-medium text-gray-700">Project Title</span>
          <input 
            type="text" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#004DE7]"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-gray-700">City</span>
          <input 
            type="text" 
            value={city} 
            onChange={(e) => setCity(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#004DE7]"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-gray-700">State / Region</span>
          <input 
            type="text" 
            value={stateName} 
            onChange={(e) => setStateName(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#004DE7]"
          />
        </label>

        <label className="flex flex-col gap-1.5 md:col-span-2">
          <span className="text-sm font-medium text-gray-700">Do you own the land?</span>
          <Switcher
            value={ownsLand}
            onChange={(val) => setOwnsLand(val)}
          />
        </label>

        <div className="flex flex-col gap-1.5 md:col-span-2">
          <span className="text-sm font-medium text-gray-700">Budget Range</span>
          <div className="flex gap-4 items-center">
            <CurrencyPicker currencies={CURRENCY_CHOICES} value={currency} onChange={setCurrency} />
            <MoneyInput
              placeholder="Min"
              value={budgetMin}
              onChange={setBudgetMin}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-left outline-none focus-visible:ring-0 focus:border-[#004DE7]"
            />
            <span className="text-gray-400">-</span>
            <MoneyInput
              placeholder="Max"
              value={budgetMax}
              onChange={setBudgetMax}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-left outline-none focus-visible:ring-0 focus:border-[#004DE7]"
            />
          </div>
        </div>
      </div>

      {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}

      <Button 
        onClick={handleCreate} 
        loading={createProject.isPending}
        disabled={!isComplete}
        className="w-full mt-4"
      >
        Create Project
      </Button>
    </div>
  );
}
