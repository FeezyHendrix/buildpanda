import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { ConsultationForm } from "@/components/sections/owners/consultation-form";
import { PageHeader } from "@/components/sections/page/page-header";
import { Section } from "@/components/ui/section";
import { site } from "@/content/site";
import { breadcrumbJsonLd } from "@/lib/json-ld";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  path: "talk-to-us",
  title: "Book a demo of BuildPanda",
  description:
    "See BuildPanda on one of your own projects: estimates and takeoffs, site diaries, inspections, materials and payments. Book a 30-minute demo with the team in Lagos.",
});

const POINTS = [
  "We set up one of your real jobs, not a sample project",
  "Your estimators, site team and office see their own part of it",
  "Pricing is per project, quoted on the call, with no implementation fee",
];

/** Where every "Book a demo" on the site lands. */
export default function TalkToUsPage() {
  return (
    <main id="main">
      <JsonLd data={breadcrumbJsonLd([{ name: "Book a demo", path: "talk-to-us" }])} />
      <PageHeader
        eyebrow="Book a demo"
        title="See BuildPanda on one of your own projects"
        lead="Tell us about your company and the job you want to run. We will set it up and walk your team through it, from the estimate to the first site diary."
      />
      <Section theme="light" className="border-t border-line">
        <div className="site-container grid gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,35.375rem)] lg:gap-x-20 lg:py-20">
          <div>
            <ul className="space-y-4">
              {POINTS.map((point) => (
                <li key={point} className="flex gap-3 leading-normal">
                  <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
                  {point}
                </li>
              ))}
            </ul>
            <p className="mt-8 text-ink-soft">
              Prefer email? <a className="font-semibold text-brand underline underline-offset-4" href={`mailto:${site.email}`}>{site.email}</a>
              <br />
              Or call {site.phones.join(" or ")}.
            </p>
          </div>
          <ConsultationForm projectType="Software demo" source="website:talk-to-us" submitLabel="Book a demo" />
        </div>
      </Section>
    </main>
  );
}
