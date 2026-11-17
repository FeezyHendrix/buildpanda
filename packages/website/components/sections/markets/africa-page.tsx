import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { PageHeader } from "@/components/sections/page/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { marketCopy } from "@/content/markets/copy";
import { marketName, marketPath, publishedMarkets } from "@/content/markets";
import { regions } from "@/content/markets/countries";
import type { Language } from "@/content/markets/types";
import { breadcrumbJsonLd } from "@/lib/json-ld";
import { LanguageLinks } from "./language-links";
import { ProjectChecklist } from "./project-checklist";
import { productFactsPath } from "@/content/product-facts";

export function AfricaPage({ language = "en" }: { language?: Language }) {
  const copy = marketCopy[language];
  return (
    <main id="main">
      <JsonLd data={breadcrumbJsonLd([{ name: copy.allCountries, path: marketPath(language) }])} />
      <PageHeader eyebrow="BuildPanda" title={copy.title} lead={copy.lead} />
      <Section theme="light" className="border-t border-line">
        <div className="site-container max-w-[64rem] space-y-12 py-12 lg:py-16">
          <LanguageLinks language={language} />
          <section>
            <h2 className="text-2xl font-semibold">{copy.directory}</h2>
            <p className="mt-3 max-w-[48rem] leading-relaxed">{copy.directoryNote}</p>
            <div className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {regions.map((region) => (
                <section key={region}>
                  <h3 className="text-lg font-semibold">{copy.regions[region]}</h3>
                  <ul className="mt-3 space-y-2">
                    {publishedMarkets.filter((market) => market.region === region).map((market) => (
                      <li key={market.code}>
                        <Link href={`/${marketPath(language, market)}/`} className="text-brand underline underline-offset-4">{marketName(market, language)}</Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </section>
          <ProjectChecklist language={language} />
          <Link href={`/${productFactsPath(language)}/`} className="block text-brand underline underline-offset-4">{copy.facts}</Link>
          <ButtonLink variant="solid" href="/talk-to-us/" hrefLang="en">{copy.demo}</ButtonLink>
        </div>
      </Section>
    </main>
  );
}
