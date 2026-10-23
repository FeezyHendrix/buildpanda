import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { ConsultationSection } from "@/components/sections/consultation/consultation-section";
import { ContractorsHero } from "@/components/sections/contractors/contractors-hero";
import { ContractorsSolutions } from "@/components/sections/contractors/contractors-solutions";
import { ContractorsWin } from "@/components/sections/contractors/contractors-win";
import { Faq } from "@/components/sections/faq/faq";
import { contractors } from "@/content/contractors";
import { breadcrumbJsonLd } from "@/lib/json-ld";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({ path: "for-contractors", ...contractors.meta });

export default function ContractorsPage() {
  return (
    <main id="main">
      <JsonLd data={breadcrumbJsonLd([{ name: "For contractors", path: "for-contractors" }])} />
      <ContractorsHero />
      <ContractorsWin />
      <ContractorsSolutions />
      {/* The FAQ's structured data lives on the home page only. */}
      <Faq />
      <ConsultationSection copy={contractors.consultation} />
    </main>
  );
}
