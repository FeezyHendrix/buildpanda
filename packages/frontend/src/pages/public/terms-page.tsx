import { LegalPage } from "./legal-page";
import { termsOfService } from "@/lib/legal-content";

export default function TermsOfServicePage() {
  return <LegalPage doc={termsOfService} />;
}
