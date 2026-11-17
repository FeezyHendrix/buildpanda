import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { PageHeader } from "@/components/sections/page/page-header";
import { Section } from "@/components/ui/section";
import { ButtonLink } from "@/components/ui/button";
import { productFacts, productFactsDate, productFactsPath } from "@/content/product-facts";
import { marketCopy } from "@/content/markets/copy";
import { marketPath } from "@/content/markets";
import type { Language } from "@/content/markets/types";
import { site } from "@/content/site";
import { breadcrumbJsonLd, softwareJsonLd } from "@/lib/json-ld";
import { canonicalUrl } from "@/lib/seo";
import { LanguageLinks } from "./language-links";

export function ProductFactsPage({ language = "en" }: { language?: Language }) {
  const copy = productFacts[language];
  const path = productFactsPath(language);
  return (
    <main id="main">
      <JsonLd data={[
        { ...softwareJsonLd, description: copy.summary },
        breadcrumbJsonLd([{ name: copy.title, path }]),
        { "@context": "https://schema.org", "@type": "FAQPage", "@id": `${canonicalUrl(path)}#answers`,
          url: canonicalUrl(path), inLanguage: language, dateModified: productFactsDate,
          publisher: { "@id": `${site.url}/#organization` }, about: { "@id": `${site.url}/#software` },
          mainEntity: copy.questions.map((question) => ({
            "@type": "Question", name: question.question,
            acceptedAnswer: { "@type": "Answer", text: question.answer },
          })),
        },
      ]} />
      <PageHeader eyebrow="BuildPanda" title={copy.title} lead={copy.summary}
        meta={<>{copy.updated}: <time dateTime={productFactsDate}>{new Intl.DateTimeFormat(language, { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${productFactsDate}T00:00:00Z`))}</time></>} />
      <Section theme="light" className="border-t border-line">
        <article className="site-container max-w-[48rem] space-y-10 py-12 lg:py-16">
          <LanguageLinks language={language} destination="product-facts" />
          {copy.questions.map((question) => (
            <section key={question.id} id={question.id}>
              <h2 className="text-2xl font-semibold">{question.question}</h2>
              <p className="mt-3 leading-relaxed">{question.answer}</p>
            </section>
          ))}
          <p><a href={`mailto:${site.email}`} className="text-brand underline underline-offset-4">{copy.contact}</a></p>
          <ButtonLink variant="solid" href="/talk-to-us/" hrefLang="en">{marketCopy[language].demo}</ButtonLink>
          <Link href={`/${marketPath(language)}/`} className="block text-brand underline underline-offset-4">{marketCopy[language].allCountries}</Link>
        </article>
      </Section>
    </main>
  );
}
