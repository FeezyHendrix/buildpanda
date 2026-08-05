import { OptionCard } from "@/components/atoms/option-card";
import { Spinner } from "@/components/atoms/spinner";
import { useProjectTemplates, type ProjectTemplateSummary } from "@/hooks/use-projects";
import { icons2 } from "@/assets/icons2/icon2";
import { ReactSVG } from "react-svg";

interface ProjectTemplateStepProps {
  selected: string | null;
  onSelect: (templateId: string | null) => void;
}

// Map template id → icon component
const TEMPLATE_ICONS: Record<string, string> = {
  "residential-new-build": icons2.house,
  "residential-renovation": icons2.factory,
  "residential-extension": icons2.skyscraper,
  "residential-fit-out": icons2.spanner,
};

// ── Template card ─────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  selected,
  onSelect,
}: {
  template: ProjectTemplateSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = TEMPLATE_ICONS[template.id] ?? icons2.house;
  return (
    <OptionCard
      icon={<ReactSVG src={Icon} />}
      title={template.name}
      subtitle={template.description}
      selected={selected}
      onClick={onSelect}
      badges={[
        { label: `${template.stageCount} Phases`, tone: "info" },
        { label: `${template.totalWeeks} Weeks`, tone: "success" },
      ]}
    />
  );
}

// ── Step ─────────────────────────────────────────────────────────────────────

function ProjectTemplateStep({ selected, onSelect }: ProjectTemplateStepProps) {
  const { data: templates = [], isPending } = useProjectTemplates();

  return (
    <div>
      <h4 className="text-h4 font-bold text-black-500">
        Start from a template?
      </h4>
      <p className="mt-2 text-caption-l text-grey-450 max-w-[480px]">
        Templates pre-fill your project with typical construction stages and starter
        tasks. You can rename, reorder or delete everything later.
      </p>

      {isPending ? (
        <div className="mt-12 flex justify-center">
          <Spinner size="md" />
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <OptionCard
            icon={<ReactSVG src={icons2.plus} />}
            title="Start blank"
            subtitle="Begin with the standard stage list only and build your own plan from scratch."
            selected={selected === null}
            onClick={() => onSelect(null)}
            badges={[
              { label: "Custom Phases", tone: "info" },
              { label: "Custom Time", tone: "success" },
            ]}
          />
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              selected={selected === template.id}
              onSelect={() => onSelect(template.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

ProjectTemplateStep.displayName = "ProjectTemplateStep";

export { ProjectTemplateStep, type ProjectTemplateStepProps };
