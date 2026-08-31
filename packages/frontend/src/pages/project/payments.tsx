import { useMemo } from "react";
import { Breadcrumbs } from "@/components/molecules/breadcrumbs";
import { PageHeader } from "@/components/molecules/page-header";
import { useProjectContext } from "@/layouts/project-layout";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { canViewSection } from "@/lib/project-types";
import { StagePaymentsSection } from "./payments/stage-payments-section";
import { PaymentRequestsSection } from "./payments/payment-requests-section";

/**
 * Payments workspace: one place for stage payments (milestones) and payment
 * requests (contractor claims). Each section is gated by the same flag +
 * resource the standalone pages used, so this merge changes presentation only.
 */
export default function ProjectPayments() {
  const { project, access } = useProjectContext();
  const { data: flagsData } = useFeatureFlags();

  const enabled = useMemo(
    () => new Map((flagsData?.flags ?? []).map((f) => [f.key, f.enabled])),
    [flagsData],
  );
  const isOn = (key: string) => enabled.get(key) ?? true;

  const showStagePayments =
    isOn("commercial.finances") && canViewSection(access, "commercial.finances", "finances");
  const showRequests =
    isOn("commercial.paymentClaims") && canViewSection(access, "commercial.paymentClaims", "finances");

  return (
    <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
      <Breadcrumbs
        items={[
          { label: "Finance", to: `/project/${project.id}/finances` },
          { label: "Payments" },
        ]}
        className="mb-4"
      />
      <PageHeader
        title="Payments"
        description="Stage payments and the requests contractors raise against them."
      />

      <div className="mt-8 flex flex-col gap-12">
        {showStagePayments && <StagePaymentsSection />}
        {showRequests && <PaymentRequestsSection />}
      </div>
    </div>
  );
}
