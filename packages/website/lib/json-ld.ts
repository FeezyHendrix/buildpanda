import { site } from "@/content/site";
import { canonicalUrl } from "./seo";

const organization = {
  "@type": "Organization",
  "@id": `${site.url}/#organization`,
  name: site.name,
  url: `${site.url}/`,
  logo: `${site.url}/logo.png`,
  description: site.description,
  email: site.email,
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "sales",
      email: site.email,
      telephone: site.phones[0],
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
  inLanguage: "en",
};

/**
 * The software product, kept separate from the managed build service on
 * /for-owners/ so the two things we sell are two entities, not one blurred one.
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
  areaServed: ["Nigeria", "Ghana", "Kenya", "South Africa", "Africa"],
  url: `${site.url}/`,
  publisher: { "@id": `${site.url}/#organization` },
  description:
    "Construction management software covering estimates and proposals, programme and delays, site diaries, inspections, variations, and payment certificates that trace to work that was signed off.",
  featureList: [
    "Estimates, bills of quantities and drawing takeoffs",
    "Programme, look-aheads and delay records",
    "Site diary and daily logs",
    "Inspections with pass or fail reports",
    "Variations and extensions of time",
    "Payment applications and certificates",
    "Material approvals, orders, deliveries and stock",
    "Offline mobile app for site crews",
  ],
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

/** A guide on the blog: who wrote it, when, and that it belongs to this site. */
export function articleJsonLd(article: { title: string; description: string; path: string; published: string; updated?: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    mainEntityOfPage: canonicalUrl(article.path),
    datePublished: article.published,
    dateModified: article.updated ?? article.published,
    author: { "@id": `${site.url}/#organization` },
    publisher: { "@id": `${site.url}/#organization` },
    image: `${site.url}/opengraph-image/`,
    inLanguage: "en",
  };
}
