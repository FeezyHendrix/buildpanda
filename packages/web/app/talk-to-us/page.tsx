import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { breadcrumbJsonLd } from "@/lib/json-ld";
import { JsonLd } from "@/components/json-ld";
import { Container } from "@/components/ui";
import { CheckIcon } from "@/components/icons";
import { CalendlyWidget } from "@/components/calendly-widget";

export const metadata: Metadata = pageMetadata({
  path: "talk-to-us",
  title: "Talk to us about your build",
  description:
    "Tell us about the job. If you want to run it yourself we will show you the software; if you would rather we ran it, we will tell you on the call whether it is one we can take.",
  socialTitle: "Tell us about the job and we will say which product fits",
});

const assurances = [
  "A team that understands building in Nigeria",
  "A clear plan from land and design through to handover",
  "Inspections you can request, with the report on the record",
  "One dashboard you can watch from anywhere in the world",
];

export default function TalkToUsPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Talk to us", path: "talk-to-us" }])} />
  <section className="bg-surface-faint py-20 sm:py-24">
        <Container>
          <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="flex flex-col gap-6">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
                Book a consultation
              </span>
              <h1 className="text-balance text-3xl font-bold leading-tight text-ink sm:text-4xl">
                Not sure who to trust with your build? Start here.
              </h1>
              <p className="text-pretty text-base leading-relaxed text-muted sm:text-lg">
                Tell us about the home you want to build. We will walk you through
                how BuildPanda manages your project from inception to handover, and
                answer every question, with no obligation.
              </p>
              <ul className="flex flex-col gap-3">
                {assurances.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                      <CheckIcon className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-sm leading-relaxed text-ink">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <CalendlyWidget />
          </div>
        </Container>
      </section>
    </>
  );
}
