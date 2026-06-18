import { LegalPage } from "./legal-page";
import { dataPolicy } from "@/lib/legal-content";

export default function DataPolicyPage() {
  return <LegalPage doc={dataPolicy} />;
}
