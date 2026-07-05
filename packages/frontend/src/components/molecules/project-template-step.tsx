import type { ComponentType, SVGAttributes } from "react";
import {
  ContractorsIcon,
  MaterialsIcon,
  OverviewIcon,
  PlusIcon,
  SparkleIcon,
} from "@/components/atoms/project-nav-icons";
import { OptionCard } from "@/components/atoms/option-card";
import { Spinner } from "@/components/atoms/spinner";
import { useProjectTemplates, type ProjectTemplateSummary } from "@/hooks/use-projects";

interface ProjectTemplateStepProps {
  /** null = "Start blank" (the default). */
  selected: string | null;
  onSelect: (templateId: string | null) => void;
}

type IconComponent = ComponentType<SVGAttributes<SVGSVGElement>>;

const TEMPLATE_ICONS: Record<string, IconComponent> = {
  "residential-new-build": OverviewIcon,
  "residential-renovation": ContractorsIcon,
  "residential-extension": MaterialsIcon,
  "residential-fit-out": SparkleIcon,
};

function TemplateCard({
  template,
  selected,
  onSelect,
}: {
  template: ProjectTemplateSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = TEMPLATE_ICONS[template.id] ?? OverviewIcon;
  return (
    <OptionCard
      icon={<Icon className="size-9" />}
      title={template.name}
      subtitle={`${template.description} ${template.stageCount} stages, ~${template.totalWeeks} weeks.`}
      badge={`${template.stageCount} stages`}
      selected={selected}
      onClick={onSelect}
      className="p-6"
    />
  );
}

function ProjectTemplateStep({ selected, onSelect }: ProjectTemplateStepProps) {
  const { data: templates = [], isPending } = useProjectTemplates();

  return (
    <div>
      <h2 className="text-center text-[25px] font-bold text-gray-900 text-balance">
        Start from a template?
      </h2>
      <p className="mt-2 text-center text-sm text-[#929292] text-pretty">
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
            icon={<PlusIcon className="size-9" />}
            title="Start blank"
            subtitle="Begin with the standard stage list only and build your own plan from scratch."
            selected={selected === null}
            onClick={() => onSelect(null)}
            className="p-6"
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
