import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { PageHeader } from "@/components/sections/page/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { guideBySlug, guides } from "@/content/guides";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/json-ld";
import { pageMetadata } from "@/lib/seo";

type Params = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return guides.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const guide = guideBySlug((await params).slug);
  if (!guide) return {};
  const metadata = pageMetadata({ path: `blog/${guide.slug}`, title: guide.title, description: guide.description });
  return {
    ...metadata,
    openGraph: { ...metadata.openGraph, type: "article", publishedTime: guide.published, modifiedTime: guide.updated ?? guide.published },
  };
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export default async function GuidePage({ params }: Params) {
  const guide = guideBySlug((await params).slug);
  if (!guide) notFound();
  const path = `blog/${guide.slug}`;
  const others = guides.filter((g) => g.slug !== guide.slug).slice(0, 3);

  return (
    <main id="main">
      <JsonLd
        data={[
          articleJsonLd({ title: guide.title, description: guide.description, path, published: guide.published, updated: guide.updated }),
          breadcrumbJsonLd([{ name: "Guides", path: "blog" }, { name: guide.title, path }]),
        ]}
      />
      <PageHeader
        eyebrow={`Guide for ${guide.audience.toLowerCase()}`}
        title={guide.title}
        meta={<><time dateTime={guide.published}>{formatDate(guide.published)}</time> · {guide.minutes} min read</>}
      />
      <Section theme="light" className="border-t border-line">
        <article className="site-container max-w-[48rem] py-12 lg:py-16">
          <div className="space-y-4 text-[1.0625rem]">
            {guide.intro.map((paragraph) => (
              <p key={paragraph.slice(0, 48)} className="leading-relaxed">{paragraph}</p>
            ))}
          </div>
          {guide.sections.map((section) => (
            <section key={section.heading} className="mt-10">
              <h2 className="text-2xl font-semibold tracking-tight text-balance">{section.heading}</h2>
              <div className="mt-3 space-y-3">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph.slice(0, 48)} className="leading-relaxed">{paragraph}</p>
                ))}
                {section.bullets ? (
                  <ul className="list-disc space-y-2 pl-5 marker:text-brand">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="leading-relaxed">{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>
          ))}
          <div className="mt-12 border-t border-line pt-8">
            <ButtonLink variant="solid" href={guide.next.href}>{guide.next.label}</ButtonLink>
          </div>
        </article>
      </Section>
      <Section theme="light" className="border-t border-line">
        <nav aria-label="More guides" className="site-container max-w-[48rem] py-12">
          <h2 className="text-lg font-semibold">More guides</h2>
          <ul className="mt-4 space-y-3">
            {others.map((other) => (
              <li key={other.slug}>
                <Link href={`/blog/${other.slug}/`} className="font-medium text-brand underline-offset-4 hover:underline">{other.title}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </Section>
    </main>
  );
}
