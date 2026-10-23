import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbJsonLd } from "@/lib/json-ld";
import { pageMetadata } from "@/lib/seo";
import { ConsultationSection } from "@/components/sections/consultation/consultation-section";
import { OwnersEyes } from "@/components/sections/owners/owners-eyes";
import { OwnersHero } from "@/components/sections/owners/owners-hero";
import { OwnersProcess } from "@/components/sections/owners/owners-process";
import { OwnersTypes } from "@/components/sections/owners/owners-types";
import { owners } from "@/content/owners";

export const metadata: Metadata = pageMetadata({ path: "for-owners", ...owners.meta });

/** The managed build, as its own service entity beside the software. */
const serviceJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Managed construction service",
  serviceType: "Residential construction management",
  provider: { "@id": "https://buildpanda.io/#organization" },
  areaServed: { "@type": "Country", name: "Nigeria" },
  description: owners.meta.description,
};

export default function OwnersPage() {
  return (
    <main id="main">
      <JsonLd data={[serviceJsonLd, breadcrumbJsonLd([{ name: "For owners", path: "for-owners" }])]} />
      <OwnersHero />
      <OwnersEyes />
      <OwnersProcess />
      <OwnersTypes />
      <ConsultationSection copy={owners.consultation} />
    </main>
  );
}
