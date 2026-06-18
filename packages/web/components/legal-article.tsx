import { Container, Badge } from "@/components/ui";
import type { LegalDocument } from "@/lib/legal";

export function LegalArticle({ doc }: { doc: LegalDocument }) {
  return (
    <>
      <section className="bg-white">
        <Container className="flex max-w-3xl flex-col gap-4 py-14 sm:py-16">
          <Badge>Legal</Badge>
          <h1 className="text-balance text-4xl font-extrabold leading-[1.1] tracking-tight text-ink sm:text-5xl">
            {doc.title}
          </h1>
          <p className="text-sm text-muted">Last updated {doc.effectiveDate}</p>
        </Container>
      </section>

      <section className="border-t border-line py-12 sm:py-16">
        <Container className="max-w-3xl">
          <div className="space-y-4">
            {doc.intro.map((p, i) => (
              <p key={i} className="text-[15px] leading-relaxed text-muted">
                {p}
              </p>
            ))}
          </div>

          <div className="mt-10 space-y-10">
            {doc.sections.map((section) => (
              <div key={section.heading}>
                <h2 className="text-lg font-bold text-ink">{section.heading}</h2>
                <div className="mt-3 space-y-3">
                  {section.body.map((p, i) => (
                    <p key={i} className="text-[15px] leading-relaxed text-muted">
                      {p}
                    </p>
                  ))}
                  {section.bullets ? (
                    <ul className="mt-2 space-y-2">
                      {section.bullets.map((b, i) => (
                        <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-muted">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
