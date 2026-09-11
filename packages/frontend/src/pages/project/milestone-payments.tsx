import { StagePaymentsSection } from "./payments/stage-payments-section";

/**
 * Standalone stage-payments view. Reached from the schedule (schedules/milestones)
 * and legacy deep links; the finance route redirects to the merged Payments
 * workspace. All the logic lives in the shared StagePaymentsSection.
 */
export default function ProjectMilestonePayments() {
  return (
    <div className="w-full px-4 lg:px-6 pt-4 pb-8 sm:px-10">
      <StagePaymentsSection />
    </div>
  );
}
