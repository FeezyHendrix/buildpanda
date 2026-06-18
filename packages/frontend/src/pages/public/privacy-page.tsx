import { LegalPage } from "./legal-page";
import { privacyPolicy } from "@/lib/legal-content";

export default function PrivacyPolicyPage() {
  return <LegalPage doc={privacyPolicy} />;
}
