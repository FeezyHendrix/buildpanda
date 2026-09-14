import { site } from "./site";
import { faqItems } from "./faq";
import { canonicalUrl } from "./seo";

const organization = {
  "@type": "Organization",
  "@id": `${site.url}/#organization`,
  name: site.name,
  url: `${site.url}/`,
  logo: `${site.url}/logo.png`,
  description: site.description,
  email: site.email,
  areaServed: ["NG", "Worldwide"],
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "sales",
      email: site.email,
      telephone: site.phones[0],
      areaServed: "NG",
      availableLanguage: ["English"],
    },
  ],
};

export const organizationJsonLd = { "@context": "https://schema.org", ...organization };

/** Names the site itself so the brand can resolve to one entity rather than
 *  being inferred separately from each page. */
export const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${site.url}/#website`,
  name: site.name,
  url: `${site.url}/`,
  description: site.description,
  publisher: { "@id": `${site.url}/#organization` },
  inLanguage: "en-NG",
};

/**
 * The software product, kept separate from the build service on /construction/
 * so the two things we sell are two entities rather than one blurred one.
 * No offers block: there is no published price, and inventing one to win a
 * rich result would be a lie in the markup.
 */
export const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: site.name,
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Construction management software",
  operatingSystem: "Web, iOS, Android",
  url: `${site.url}/`,
  publisher: { "@id": `${site.url}/#organization` },
  description:
    "Construction management software covering estimates and proposals, programme and delays, site diaries, inspections, variations, and payment certificates that trace to work that was signed off.",
  featureList: [
    "Estimates and proposals",
    "Programme, look-aheads and delay records",
    "Site diary and daily logs",
    "Inspections with pass or fail reports",
    "Variations and extensions of time",
    "Payment applications and certificates",
  ],
};

/** The homepage answers eight questions buyers actually ask; marking them up
 *  is the one rich result this site can honestly earn today. */
export const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

/** Inner pages are two levels deep at most, so a trail is cheap and tells the
 *  crawler how the two product lines are organised. */
export function breadcrumbJsonLd(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Home", path: "" }, ...trail].map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: canonicalUrl(crumb.path),
    })),
  };
}
