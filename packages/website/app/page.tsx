import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { Faq } from "@/components/sections/faq/faq";
import { Fragmentation } from "@/components/sections/fragmentation/fragmentation";
import { Hero } from "@/components/sections/hero/hero";
import { Site } from "@/components/sections/site/site";
import { Takeoff } from "@/components/sections/takeoff/takeoff";
import { Workspace } from "@/components/sections/workspace/workspace";
import { softwareJsonLd } from "@/lib/json-ld";
import { pageMetadata } from "@/lib/seo";

// The home page is the contractors' page: the title leads with the phrase
// they search for, the description with what they do on it.
export const metadata: Metadata = pageMetadata({
  path: "",
  title: "Construction management software for Africa",
  socialTitle: "BuildPanda: run the entire build from one system",
  description:
    "Construction management software built for contractors in Nigeria and across Africa: takeoffs and estimates, schedules, site diaries, inspections, materials and payment certificates in one system, online or offline.",
});

export default function HomePage() {
  return (
    <main id="main">
      <JsonLd data={softwareJsonLd} />
      <Hero />
      <Fragmentation />
      <Takeoff />
      <Site />
      <Workspace />
      <Faq structuredData />
    </main>
  );
}
