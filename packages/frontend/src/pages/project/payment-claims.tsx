import { PaymentRequestsSection } from "./payments/payment-requests-section";

/**
 * Standalone payment-requests view (kept for direct links and paymentClaims-only
 * access). The merged Payments workspace renders the same shared section.
 */
export default function ProjectPaymentClaims() {
  return (
    <div className="w-full px-4 lg:px-6 pt-4 pb-8 sm:px-10">
      <PaymentRequestsSection />
    </div>
  );
}
