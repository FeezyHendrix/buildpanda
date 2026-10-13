import type { Metadata } from "next";
import { AboutHero } from "@/components/sections/about/about-hero";
import { AboutStory } from "@/components/sections/about/about-story";
import { AboutValues } from "@/components/sections/about/about-values";
import { Faq } from "@/components/sections/faq/faq";
import { about } from "@/content/about";

export const metadata: Metadata = {
  title: about.meta.title,
  description: about.meta.description,
};

export default function AboutPage() {
  return (
    <main id="main">
      <AboutHero />
      <AboutStory />
      <AboutValues />
      <Faq />
    </main>
  );
}
