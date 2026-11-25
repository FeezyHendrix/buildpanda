import { ReactSVG } from "react-svg";
import { Spinner } from "@/components/atoms/spinner";
import { icons2 } from "@/assets/icons2/icon2";
import { useProjectTemplates, type ProjectTemplateSummary } from "@/hooks/use-projects";
import CardBg from "@/assets/images/card-bg.png";
import { cn } from "@/lib/utils";

interface ProjectTemplateStepProps {
  selected: string | null;
  onSelect: (templateId: string | null) => void;
}

// Map template id → icon asset
const TEMPLATE_ICONS: Record<string, string> = {
  "residential-new-build": icons2.house,
  "residential-renovation": icons2.factory,
  "residential-extension": icons2.skyscraper,
  "residential-fit-out": icons2.spanner,
};

/** "46 - 138 Weeks" when the template knows its range, else its planned length. */
export function templateWeeksLabel(template: Pick<ProjectTemplateSummary, "totalWeeks" | "minWeeks" | "maxWeeks">): string {
  return template.minWeeks !== undefined && template.maxWeeks !== undefined
    ? `${template.minWeeks} - ${template.maxWeeks} Weeks`
    : `${template.totalWeeks} Weeks`;
}

function Pill({ tone, selected, children }: { tone: "info" | "success"; selected: boolean; children: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[24px] items-center rounded-full border px-[8px] text-[12px] font-medium leading-[16px]",
        selected
          ? "border-white/40 bg-white/15 text-white"
          : tone === "info"
            ? "border-transparent bg-[#E6EDFD] text-[#004DE7]"
            : "border-[#D7F5E0] bg-[#F0FDF4] text-[#00A63E]",
      )}
    >
      {children}
    </span>
  );
}

// ── Template card ─────────────────────────────────────────────────────────────

function TemplateCard({
  icon,
  title,
  description,
  pills,
  selected,
  onSelect,
}: {
  icon: string;
  title: string;
  description: string;
  pills: [string, string];
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "flex flex-col items-start bg-white bg-cover bg-center bg-no-repeat px-[21px] pb-[21px] pt-[22px] text-left outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-[#004DE7]/20",
        selected ? "border-2 border-[#004DE7] px-[20px] pb-[20px] pt-[21px]" : "border border-[#EEEEEE] hover:border-[#CCCCCC]",
      )}
      style={{ backgroundImage: selected ? `url(${CardBg})` : undefined }}
    >
      <ReactSVG src={icon} className={cn("[&_svg]:size-6", selected ? "[&_path]:fill-white" : "[&_path]:fill-black")} aria-hidden />
      <span className={cn("mt-[8px] text-[16px] font-medium leading-[20px]", selected ? "text-white" : "text-[#1E1E1E]")}>
        {title}
      </span>
      <span className={cn("mb-[8px] mt-[6px] text-[14px] leading-[20px]", selected ? "text-white" : "text-[#737373]")}>
        {description}
      </span>
      <span className="mt-auto flex flex-wrap gap-[8px]">
        <Pill tone="info" selected={selected}>{pills[0]}</Pill>
        <Pill tone="success" selected={selected}>{pills[1]}</Pill>
      </span>
    </button>
  );
}

// ── Step ─────────────────────────────────────────────────────────────────────

function ProjectTemplateStep({ selected, onSelect }: ProjectTemplateStepProps) {
  const { data: templates = [], isPending } = useProjectTemplates();

  return (
    <div>
      <h1 className="text-[36px] font-bold leading-[44px] tracking-[-0.04em] text-[#1E1E1E]">
        Start from a template?
      </h1>
      <p className="mt-[4px] max-w-[480px] text-[14px] leading-[20px] text-[#737373]">
        Templates pre-fill your project with typical construction stages and starter
        tasks. You can rename, reorder or delete everything later.
      </p>

      {isPending ? (
        <div className="mt-12 flex justify-center">
          <Spinner size="md" />
        </div>
      ) : (
        <div className="mt-[40px] grid grid-cols-1 gap-[23px] sm:grid-cols-2">
          <TemplateCard
            icon={icons2.plus}
            title="Start blank"
            description="Begin with the standard stage list only and build your own plan from scratch."
            pills={["Custom Phases", "Custom Time"]}
            selected={selected === null}
            onSelect={() => onSelect(null)}
          />
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              icon={TEMPLATE_ICONS[template.id] ?? icons2.house}
              title={template.name}
              description={template.description}
              pills={[`${template.stageCount} Phases`, templateWeeksLabel(template)]}
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
