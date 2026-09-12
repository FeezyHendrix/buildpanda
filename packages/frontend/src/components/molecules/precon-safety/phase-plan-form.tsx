import { useEffect, useState } from "react";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import type { EmergencyContact, PhasePlan, PhasePlanInput } from "@/api/precon-safety";
import { useConfirmPhasePlan, useDraftPhasePlan, usePhasePlan, useSavePhasePlan } from "@/hooks/use-precon-safety";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { DraftButton, DraftStateChip, StringListEditor, cellInputClass, cellTextareaClass } from "./safety-shared";

interface Props {
  proposalId: string;
}

// Field order follows the HSE small-projects construction phase plan template,
// so a printed copy reads the way an inspector expects.
const TEXT_FIELDS = [
  { key: "keyDatesNote", label: "Key dates", hint: "What must be in place before work starts, and the build stages" },
  { key: "siteRules", label: "Site rules", hint: "Access, hours, deliveries, housekeeping, visitors" },
  { key: "welfare", label: "Welfare arrangements", hint: "Toilets, washing, rest and drinking water" },
  { key: "firstAid", label: "First aid", hint: "Kit, trained person, nearest hospital" },
  { key: "servicesIsolation", label: "Isolation of services", hint: "Electricity, water, gas and buried services" },
  { key: "asbestosNote", label: "Asbestos and hazardous materials", hint: "Survey status and what to do if found" },
  { key: "supervision", label: "Supervision", hint: "Who is in charge on site and how the gang is briefed" },
] as const;
type TextKey = (typeof TEXT_FIELDS)[number]["key"];

// Form state keeps text as strings (never null) so inputs stay controlled;
// nulls from the API become empty strings and go back as the API's shape.
type PlanForm = Record<TextKey, string> & Pick<Required<PhasePlanInput>, "hazards" | "emergencyContacts">;

function draftFrom(plan: PhasePlan | null): PlanForm {
  return {
    keyDatesNote: plan?.keyDatesNote ?? "",
    siteRules: plan?.siteRules ?? "",
    welfare: plan?.welfare ?? "",
    firstAid: plan?.firstAid ?? "",
    servicesIsolation: plan?.servicesIsolation ?? "",
    asbestosNote: plan?.asbestosNote ?? "",
    hazards: plan?.hazards ?? [],
    supervision: plan?.supervision ?? "",
    emergencyContacts: plan?.emergencyContacts ?? [],
  };
}

export function PhasePlanForm({ proposalId }: Props) {
  const { data: plan, isPending, isError, error } = usePhasePlan(proposalId);
  const save = useSavePhasePlan(proposalId);
  const confirm = useConfirmPhasePlan(proposalId);
  const draft = useDraftPhasePlan(proposalId);
  const [form, setForm] = useState<PlanForm>(() => draftFrom(plan ?? null));

  useEffect(() => {
    setForm(draftFrom(plan ?? null));
  }, [plan]);

  const dirty = JSON.stringify(form) !== JSON.stringify(draftFrom(plan ?? null));
  const fail = (fallback: string) => (err: unknown) => toast(getApiErrorMessage(err, fallback), "error");
  const setText = (key: TextKey, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const setContact = (index: number, patch: Partial<EmergencyContact>) =>
    setForm((f) => ({ ...f, emergencyContacts: f.emergencyContacts.map((c, i) => (i === index ? { ...c, ...patch } : c)) }));

  if (isPending) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size="sm" />
      </div>
    );
  }
  if (isError) {
    return <p className="px-4 py-6 text-sm text-red-600">{getApiErrorMessage(error, "Could not load the phase plan.")}</p>;
  }

  return (
    <section className="rounded-lg border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-hair px-4 py-3">
        <div className="flex items-center gap-2">
          <div>
            <p className="text-sm font-semibold text-gray-900">Construction phase plan</p>
            <p className="text-xs text-gray-500">Site-specific arrangements before the first day on site.</p>
          </div>
          {plan ? <DraftStateChip state={plan.status} /> : null}
          {dirty ? <span className="text-xs text-amber-700">Unsaved changes</span> : null}
        </div>
        <div className="flex items-center gap-2">
          <DraftButton
            label={plan ? "Redraft with Panda AI" : "Draft with Panda AI"}
            loading={draft.isPending}
            onClick={() =>
              draft.mutate(undefined, {
                onSuccess: () => toast("Phase plan drafted. Check every field before confirming.", "success"),
                onError: fail("Panda AI could not draft the phase plan."),
              })
            }
          />
          {plan && plan.status !== "confirmed" && !dirty ? (
            <Button size="sm" variant="secondary" loading={confirm.isPending} onClick={() => confirm.mutate(undefined, { onSuccess: () => toast("Phase plan confirmed.", "success"), onError: fail("Could not confirm the plan.") })}>
              Confirm
            </Button>
          ) : null}
          <Button
            size="sm"
            disabled={!dirty}
            loading={save.isPending}
            onClick={() =>
              save.mutate(
                { ...form, hazards: form.hazards.map((h) => h.trim()).filter(Boolean), emergencyContacts: form.emergencyContacts.filter((c) => c.name.trim()) },
                { onSuccess: () => toast("Phase plan saved.", "success"), onError: fail("Could not save the plan.") },
              )
            }
          >
            Save
          </Button>
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-2">
        {TEXT_FIELDS.map((field) => (
          <label key={field.key} className="text-xs font-medium text-gray-600">
            {field.label}
            <textarea
              className={cn(cellTextareaClass, "mt-1 min-h-20")}
              placeholder={field.hint}
              value={form[field.key]}
              onChange={(e) => setText(field.key, e.target.value)}
            />
          </label>
        ))}
        <div>
          <p className="mb-1 text-xs font-medium text-gray-600">Main hazards</p>
          <StringListEditor values={form.hazards} onChange={(hazards) => setForm((f) => ({ ...f, hazards }))} placeholder="e.g. Deep excavation next to the boundary wall" addLabel="Add hazard" />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-medium text-gray-600">Emergency contacts</p>
            <button
              type="button"
              className="text-xs font-semibold text-primary-700 hover:underline"
              onClick={() => setForm((f) => ({ ...f, emergencyContacts: [...f.emergencyContacts, { name: "", role: "", phone: "" }] }))}
            >
              + Add contact
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {form.emergencyContacts.map((contact, index) => (
              <div key={index} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
                <input aria-label="Name" className={cellInputClass} placeholder="Name" value={contact.name} onChange={(e) => setContact(index, { name: e.target.value })} />
                <input aria-label="Role" className={cellInputClass} placeholder="Role" value={contact.role} onChange={(e) => setContact(index, { role: e.target.value })} />
                <input aria-label="Phone" className={cellInputClass} placeholder="Phone" value={contact.phone} onChange={(e) => setContact(index, { phone: e.target.value })} />
                <button type="button" className="text-xs text-gray-400 hover:text-red-600" onClick={() => setForm((f) => ({ ...f, emergencyContacts: f.emergencyContacts.filter((_, i) => i !== index) }))}>
                  Remove
                </button>
              </div>
            ))}
            {form.emergencyContacts.length === 0 ? <p className="text-xs text-gray-400">Site manager, first aider, nearest hospital.</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
PhasePlanForm.displayName = "PhasePlanForm";
