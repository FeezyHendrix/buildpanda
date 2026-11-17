import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { PageHeader } from "@/components/sections/page/page-header";
import { Section } from "@/components/ui/section";
import { guides } from "@/content/guides";
import { breadcrumbJsonLd } from "@/lib/json-ld";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  path: "blog",
  title: "Construction guides for contractors and owners",
  description:
    "Practical guides on running construction projects in Nigeria and Africa: building from abroad, choosing construction software, tracking materials and keeping a site diary.",
});

export default function GuidesPage() {
  return (
    <main id="main">
      <JsonLd data={breadcrumbJsonLd([{ name: "Guides", path: "blog" }])} />
      <PageHeader
        eyebrow="Guides"
        title="Construction guides"
        lead="How to run a build well in Nigeria and across Africa: for contractors who deliver projects and owners who pay for them."
      />
      <Section theme="light" className="border-t border-line">
        <ul className="site-container grid max-w-[64rem] gap-4 py-12 md:grid-cols-2 lg:py-16">
          {guides.map((guide) => (
            <li key={guide.slug} className="border border-line bg-white">
              <Link href={`/blog/${guide.slug}/`} className="flex h-full flex-col gap-3 p-6 hover:bg-card-soft">
                <span className="text-[0.8125rem] font-semibold text-brand">{guide.audience} · {guide.minutes} min read</span>
                <span className="text-xl leading-snug font-semibold tracking-tight text-balance">{guide.title}</span>
                <span className="leading-normal text-ink-soft">{guide.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </main>
  );
}
