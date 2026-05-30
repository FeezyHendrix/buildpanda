import { OptionCard } from "@/components/atoms/option-card";
import buildHomeIcon from "@/assets/icons/build-a-new-home-icon.svg";
import renovateIcon from "@/assets/icons/renovate-a-property.svg";
import investIcon from "@/assets/icons/invest-in-real-estate.svg";

type ProjectType = "build" | "renovate" | "invest";

interface ProjectTypeStepProps {
  selected: ProjectType | null;
  onSelect: (type: ProjectType) => void;
}

const options = [
  {
    type: "build" as const,
    icon: buildHomeIcon,
    title: "Build a Home",
    subtitle:
      "Start a construction project from scratch with vetted architects and contractors.",
  },
  {
    type: "renovate" as const,
    icon: renovateIcon,
    title: "Renovate a Property",
    subtitle:
      "Update or expand your current property. Manage repairs and modernizations remotely.",
  },
  {
    type: "invest" as const,
    icon: investIcon,
    title: "Invest in Real Estate",
    subtitle:
      "Browse vetted development opportunities and fractional ownership projects.",
    badge: "Coming Soon",
  },
] as const;

function ProjectTypeStep({ selected, onSelect }: ProjectTypeStepProps) {
  return (
    <div>
      <h2 className="text-center text-[25px] font-bold text-gray-900 text-balance">
        What would you like to do?
      </h2>
      <p className="mt-2 text-center text-sm text-[#929292] text-pretty">
        Select the option that best describes your goal. We'll help you manage
        the process from anywhere in the world.
      </p>

      <div className="mt-8 flex gap-5">
        {options.map((option) => (
          <OptionCard
            key={option.type}
            icon={
              <img src={option.icon} alt="" className="size-12" />
            }
            title={option.title}
            subtitle={option.subtitle}
            selected={selected === option.type}
            badge={"badge" in option ? option.badge : undefined}
            onClick={() => onSelect(option.type)}
          />
        ))}
      </div>
    </div>
  );
}

ProjectTypeStep.displayName = "ProjectTypeStep";

export { ProjectTypeStep, type ProjectTypeStepProps, type ProjectType, options as PROJECT_TYPE_OPTIONS };
