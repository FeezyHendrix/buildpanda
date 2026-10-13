import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbJsonLd } from "@/lib/json-ld";
import { pageMetadata } from "@/lib/seo";
import { AboutHero } from "@/components/sections/about/about-hero";
import { AboutStory } from "@/components/sections/about/about-story";
import { AboutValues } from "@/components/sections/about/about-values";
import { Faq } from "@/components/sections/faq/faq";
import { about } from "@/content/about";

export const metadata: Metadata = pageMetadata({ path: "about", ...about.meta });

export default function AboutPage() {
  return (
    <main id="main">
      <JsonLd data={breadcrumbJsonLd([{ name: "About", path: "about" }])} />
      <AboutHero />
      <AboutStory />
      <AboutValues />
      <Faq />
    </main>
  );
}
