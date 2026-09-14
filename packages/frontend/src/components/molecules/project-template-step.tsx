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
import { QueryError } from "./query-error";
import type { ProjectType } from "./project-type-step";

interface ProjectTemplateStepProps {
  projectType: ProjectType | null;
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

function ProjectTemplateStep({ projectType, selected, onSelect }: ProjectTemplateStepProps) {
  const { data: templates = [], isPending, error, refetch } = useProjectTemplates();
  const matchingTemplates = templates.filter(template => template.projectType === projectType);

  return (
    <div>
      <h2 className="text-center text-[25px] font-medium text-gray-900 text-balance">
        {projectType === "renovate" ? "Choose a renovation template" : "Choose a home-building template"}
      </h2>
      <p className="mt-2 text-center text-sm text-gray-400 text-pretty">
        Choose a starting programme for your {projectType === "renovate" ? "renovation" : "new home"},
        or start blank. You can edit the stages and tasks later.
      </p>

      {error ? <QueryError error={error} retry={refetch} noun="project templates" /> : null}

      {isPending ? (
        <div className="mt-12 flex justify-center">
          <Spinner size="md" />
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <OptionCard
            icon={<PlusIcon className="size-9" />}
            title="Start blank"
            subtitle="Start without stages or tasks and build your own programme."
            selected={selected === null}
            onClick={() => onSelect(null)}
            className="p-6"
          />
          {matchingTemplates.map((template) => (
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
