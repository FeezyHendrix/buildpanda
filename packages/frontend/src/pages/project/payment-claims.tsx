import { Breadcrumbs } from "@/components/molecules/breadcrumbs";
import { useProjectContext } from "@/layouts/project-layout";
import { PaymentRequestsSection } from "./payments/payment-requests-section";

/**
 * Standalone payment-requests view (kept for direct links and paymentClaims-only
 * access). The merged Payments workspace renders the same shared section.
 */
export default function ProjectPaymentClaims() {
  const { project } = useProjectContext();

  return (
    <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
      <Breadcrumbs
        items={[
          { label: "Finance", to: `/project/${project.id}/finances` },
          { label: "Payment requests" },
        ]}
        className="mb-4"
      />
      <PaymentRequestsSection />
    </div>
  );
}
