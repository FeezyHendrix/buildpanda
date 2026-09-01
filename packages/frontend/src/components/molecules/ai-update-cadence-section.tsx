import { Badge, type BadgeTone } from "@/components/atoms/badge";
import { RadioCard } from "@/components/atoms/radio-card";
import {
  useProjectSettings,
  useUpdateProjectSettings,
} from "@/hooks/use-projects";
import { getApiErrorMessage } from "@/lib/api-error";
import { AI_UPDATE_CADENCES, type AiUpdateCadence } from "@/lib/project-types";
import { toast } from "@/lib/toast";

interface CadenceMeta {
  title: string;
  audience: string;
  audienceTone: BadgeTone;
  description: string;
  toast: string;
}

const CADENCE_META: Record<AiUpdateCadence, CadenceMeta> = {
  off: {
    title: "Off",
    audience: "Nothing is drafted",
    audienceTone: "neutral",
    description:
      "Panda AI writes nothing for this project. Only updates your team writes by hand are posted.",
    toast: "Panda AI drafts are off for this project.",
  },
  daily: {
    title: "Daily internal digest",
    audience: "Your team only — never the homeowner",
    audienceTone: "accent",
    description:
      "An end-of-day site record for the build team, in trade language: RFIs, approvals, change requests, materials, drawing markups and money recorded that day. It is not written for the client — read it before publishing anything from it.",
    toast: "Panda AI will draft a daily internal digest for your team.",
  },
  weekly: {
    title: "Weekly client update",
    audience: "Written for the homeowner",
    audienceTone: "info",
    description:
      "A weekly progress update addressed to the client, drawn from daily logs, activities, deliveries and RFIs. It waits in Drafts — publishing it is what shares it with the homeowner.",
    toast: "Panda AI will draft a weekly client update.",
  },
  both: {
    title: "Both",
    audience: "One for the homeowner, one for your team",
    audienceTone: "success",
    description:
      "The weekly client update and the daily internal digest. Each lands in Drafts separately and each needs its own review before it goes anywhere.",
    toast: "Panda AI will draft the weekly client update and the daily internal digest.",
  },
};

export function AiUpdateCadenceSection({
  projectId,
  canManage,
}: {
  projectId: string;
  canManage: boolean;
}) {
  const { data: settings } = useProjectSettings(projectId);
  const updateSettings = useUpdateProjectSettings(projectId);
  const cadence: AiUpdateCadence = updateSettings.isPending
    ? (updateSettings.variables?.aiUpdateCadence ?? "weekly")
    : (settings?.aiUpdateCadence ?? "weekly");

  function handleSelect(value: AiUpdateCadence): void {
    if (value === cadence) return;
    updateSettings.mutate(
      { aiUpdateCadence: value },
      {
        onSuccess: () => toast(CADENCE_META[value].toast, "success"),
        onError: (e) =>
          toast(getApiErrorMessage(e, "Could not update the setting."), "error"),
      },
    );
  }

  return (
    <section className="mt-6 rounded-2xl border border-[#F0F0F0] bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Panda AI update drafts
          </h2>
          <p className="mt-1 text-sm text-gray-500 text-pretty">
            Choose what Panda AI drafts from this project's field data. Every draft
            waits in Drafts for your team to review — nothing reaches the homeowner
            until someone here publishes it.
          </p>
        </div>
      </div>

      {canManage ? (
        <div
          role="group"
          aria-label="Panda AI draft cadence"
          className="mt-5 flex flex-col gap-3"
        >
          {AI_UPDATE_CADENCES.map((value) => (
            <CadenceOption
              key={value}
              value={value}
              selected={value === cadence}
              disabled={updateSettings.isPending}
              onSelect={handleSelect}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

AiUpdateCadenceSection.displayName = "AiUpdateCadenceSection";

function CadenceOption({
  value,
  selected,
  disabled,
  onSelect,
}: {
  value: AiUpdateCadence;
  selected: boolean;
  disabled: boolean;
  onSelect: (value: AiUpdateCadence) => void;
}) {
  const meta = CADENCE_META[value];

  return (
    <RadioCard
      selected={selected}
      disabled={disabled}
      onClick={() => onSelect(value)}
      className="p-4"
      title={
        <span className="flex flex-wrap items-center gap-2">
          {meta.title}
          <Badge tone={meta.audienceTone} size="sm" dot>
            {meta.audience}
          </Badge>
        </span>
      }
      description={meta.description}
    />
  );
}

CadenceOption.displayName = "CadenceOption";
