import { RadioCard, ToggleRow } from "@/components/atoms";
import milestoneIcon from "@/assets/icons/milestone-icon.svg";
import independentIcon from "@/assets/icons/independent-icon.svg";
import droneMonitoringIcon from "@/assets/icons/drone-monitoring.svg";
import thirdPartyQualityIcon from "@/assets/icons/third-party-quality.svg";

type InvolvementLevel = "full" | "approve" | "contractors";

interface RiskOption {
  id: string;
  enabled: boolean;
}

const INVOLVEMENT_OPTIONS = [
  {
    id: "full" as const,
    title: "Full Management",
    description:
      "Complete project oversight by our platform experts. Hands-on experience.",
  },
  {
    id: "approve" as const,
    title: "Approve Every Stage",
    description:
      "Review and sign off on every construction milestone before proceeding.",
  },
  {
    id: "contractors" as const,
    title: "I Have Contractors",
    description:
      "Use your own trusted team with our advanced tracking and payment tools.",
  },
] as const;

interface RiskOptionConfig {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  comingSoon?: boolean;
}

const RISK_OPTIONS_CONFIG: RiskOptionConfig[] = [
  {
    id: "milestone-payment",
    title: "Milestone-Based Payment Release",
    description:
      "Funds are only released to contractors after you verify stage completion.",
    icon: (
      <img src={milestoneIcon} alt="" aria-hidden="true" className="size-[50px]" />
    ),
  },
  {
    id: "quantity-audits",
    title: "Independent Quantity Surveyor Audits",
    description:
      "A certified third-party professional verifies all material costs and usage.",
    icon: (
      <img src={independentIcon} alt="" aria-hidden="true" className="size-[50px]" />
    ),
  },
  {
    id: "drone-monitoring",
    title: "Drone Monitoring",
    description:
      "Weekly high-resolution aerial photos and videos of your construction site.",
    icon: (
      <img src={droneMonitoringIcon} alt="" aria-hidden="true" className="size-[50px]" />
    ),
  },
  {
    id: "quality-inspection",
    title: "Third-Party Quality Inspection",
    description:
      "Professional structural inspections at the foundation, lintel, and roofing stages.",
    icon: (
      <img src={thirdPartyQualityIcon} alt="" aria-hidden="true" className="size-[50px]" />
    ),
  },
];

interface ManagementStepProps {
  involvementLevel: InvolvementLevel | null;
  riskOptions: RiskOption[];
  onInvolvementChange: (level: InvolvementLevel) => void;
  onRiskOptionToggle: (id: string) => void;
}

function ManagementStep({
  involvementLevel,
  riskOptions,
  onInvolvementChange,
  onRiskOptionToggle,
}: ManagementStepProps) {
  const isRiskEnabled = (id: string) =>
    riskOptions.find((o) => o.id === id)?.enabled ?? false;

  return (
    <div>
      <h2 className="text-center text-[25px] font-bold text-gray-900 text-balance">
        How Would You Like to Manage Your Project?
      </h2>
      <p className="mt-2 text-center text-sm text-[#64748B] text-pretty">
        Configure your management level and risk protection preferences to
        ensure your peace of mind throughout the construction journey.
      </p>

      <div className="mt-10 space-y-12">
        <section>
          <h3 className="mb-4 text-base font-semibold text-gray-900">
            Level of Involvement
          </h3>
          <div className="grid gap-4 md:grid-cols-3">
            {INVOLVEMENT_OPTIONS.map((opt) => (
              <RadioCard
                key={opt.id}
                title={opt.title}
                description={opt.description}
                selected={involvementLevel === opt.id}
                onClick={() => onInvolvementChange(opt.id)}
              />
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-4 text-base font-semibold text-gray-900">
            Risk Protection Options
          </h3>
          <div className="space-y-3">
            {RISK_OPTIONS_CONFIG.map((opt) => (
              <ToggleRow
                key={opt.id}
                icon={opt.icon}
                title={opt.title}
                description={opt.description}
                badge={opt.comingSoon ? "Coming soon!" : undefined}
                checked={isRiskEnabled(opt.id)}
                onChange={() => onRiskOptionToggle(opt.id)}
                disabled={opt.comingSoon}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

ManagementStep.displayName = "ManagementStep";

export {
  ManagementStep,
  type ManagementStepProps,
  type InvolvementLevel,
  type RiskOption,
  RISK_OPTIONS_CONFIG,
  INVOLVEMENT_OPTIONS,
};
