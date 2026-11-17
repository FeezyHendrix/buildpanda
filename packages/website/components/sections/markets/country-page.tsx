import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { PageHeader } from "@/components/sections/page/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { marketCopy } from "@/content/markets/copy";
import { marketGuides, marketName, marketPath, marketResources, publishedMarkets } from "@/content/markets";
import type { Language } from "@/content/markets/types";
import { breadcrumbJsonLd } from "@/lib/json-ld";
import { canonicalUrl } from "@/lib/seo";
import { LanguageLinks } from "./language-links";
import { ProjectChecklist } from "./project-checklist";
import { productFactsPath } from "@/content/product-facts";

export function CountryPage({ country, language = "en" }: { country: string; language?: Language }) {
  const market = publishedMarkets.find((entry) => entry.slug === country);
  if (!market) notFound();
  const guide = marketGuides[language][market.code];
  const copy = marketCopy[language];
  const title = `${copy.countryTitle} ${marketName(market, language)}`;
  const path = marketPath(language, market);
  const resource = marketResources[market.code];
  return (
    <main id="main">
      <JsonLd data={[
        breadcrumbJsonLd([{ name: copy.allCountries, path: marketPath(language) }, { name: marketName(market, language), path }]),
        { "@context": "https://schema.org", "@type": "WebPage", name: title, description: guide.description,
          url: canonicalUrl(path), inLanguage: language,
          spatialCoverage: { "@type": "Country", name: market.name },
          citation: resource.url },
      ]} />
      <PageHeader eyebrow={copy.guides} title={title} lead={guide.intro} />
      <Section theme="light" className="border-t border-line">
        <article className="site-container max-w-[48rem] space-y-10 py-12 lg:py-16">
          <LanguageLinks language={language} market={market} />
          {guide.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-2xl font-semibold">{section.heading}</h2>
              <p className="mt-3 leading-relaxed">{section.body}</p>
            </section>
          ))}
          <section>
            <h2 className="text-2xl font-semibold">{copy.pilot}</h2>
            <p className="mt-3 leading-relaxed">{guide.pilot}</p>
          </section>
          <section className="border-s-2 border-brand ps-5">
            <h2 className="text-lg font-semibold">{copy.source}</h2>
            <a href={resource.url} className="mt-2 inline-block text-brand underline underline-offset-4"><bdi>{resource.name}</bdi></a>
            <p className="mt-2 leading-relaxed">{copy.sourceNote}</p>
          </section>
          <ProjectChecklist language={language} />
          <Link href={`/${productFactsPath(language)}/`} className="block text-brand underline underline-offset-4">{copy.facts}</Link>
          <ButtonLink variant="solid" href="/talk-to-us/" hrefLang="en">{copy.demo}</ButtonLink>
          <Link href={`/${marketPath(language)}/`} className="block text-brand underline underline-offset-4">{copy.allCountries}</Link>
        </article>
      </Section>
    </main>
  );
}
