import { Section } from "@/components/ui/section";
import type { LegalDocument } from "@/lib/legal";
import { PageHeader } from "./page-header";

/** A policy page: the document's own words, in the site's type and spacing. */
export function LegalArticle({ doc }: { doc: LegalDocument }) {
  return (
    <main id="main">
      <PageHeader eyebrow="Legal" title={doc.title} meta={`Last updated ${doc.effectiveDate}`} />
      <Section theme="light" className="border-t border-line">
        <article className="site-container max-w-[48rem] py-12 lg:py-16">
          <div className="space-y-4">
            {doc.intro.map((paragraph) => (
              <p key={paragraph.slice(0, 48)} className="leading-relaxed">{paragraph}</p>
            ))}
          </div>
          <div className="mt-10 space-y-10">
            {doc.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-lg font-semibold">{section.heading}</h2>
                <div className="mt-3 space-y-3">
                  {section.body.map((paragraph) => (
                    <p key={paragraph.slice(0, 48)} className="leading-relaxed text-ink-soft">{paragraph}</p>
                  ))}
                  {section.bullets ? (
                    <ul className="list-disc space-y-2 pl-5 text-ink-soft marker:text-brand">
                      {section.bullets.map((bullet) => (
                        <li key={bullet.slice(0, 48)} className="leading-relaxed">{bullet}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </section>
            ))}
          </div>
        </article>
      </Section>
    </main>
  );
}
