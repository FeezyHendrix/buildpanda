import { useLocation } from "react-router-dom";
import { Breadcrumbs } from "@/components/molecules/breadcrumbs";
import { useProjectContext } from "@/layouts/project-layout";
import { StagePaymentsSection } from "./payments/stage-payments-section";

/**
 * Standalone stage-payments view. Reached from the schedule (schedules/milestones)
 * and legacy deep links; the finance route redirects to the merged Payments
 * workspace. All the logic lives in the shared StagePaymentsSection.
 */
export default function ProjectMilestonePayments() {
  const { project } = useProjectContext();
  const location = useLocation();
  const isUnderSchedules = location.pathname.includes("/schedules");

  return (
    <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
      <Breadcrumbs
        items={[
          isUnderSchedules
            ? { label: "Schedules", to: `/project/${project.id}/schedules` }
            : { label: "Finance", to: `/project/${project.id}/finances` },
          { label: "Stage payments" },
        ]}
        className="mb-4"
      />
      <StagePaymentsSection />
    </div>
  );
}
