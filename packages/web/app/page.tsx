import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { faqJsonLd, softwareJsonLd } from "@/lib/json-ld";
import { JsonLd } from "@/components/json-ld";
import { Hero } from "@/components/home/hero";
import { TwoDoors } from "@/components/home/two-doors";
import { Objections } from "@/components/home/objections";
import { Verification } from "@/components/home/verification";
import { ProductShots } from "@/components/home/product-shots";
import { WhereYouWork } from "@/components/home/where-you-work";
import { Roles } from "@/components/home/roles";
import { GoLive } from "@/components/home/go-live";
import { Faq } from "@/components/home/faq";
import { FinalCta } from "@/components/home/final-cta";
import { StickyCta } from "@/components/home/sticky-cta";

export const metadata: Metadata = pageMetadata({
  path: "",
  // Nobody searches "verified construction delivery"; that positioning line
  // carries the badge, the description and the social card. The tab and the
  // search result get the term buyers actually type.
  title: "Construction management software",
  description:
    "BuildPanda is the software contractors, developers and project managers run their builds on: estimates, programme and delays, inspections, and payment certificates that trace to work that was signed off. Or have us run the build. Start free, no card.",
  socialTitle: "Run every project from estimate to handover, on one system",
});

export default function HomePage() {
  return (
    <>
      <JsonLd data={[softwareJsonLd, faqJsonLd]} />
      <Hero />
      <TwoDoors />
      <Objections />
      <Verification />
      <ProductShots />
      <WhereYouWork />
      <Roles />
      <GoLive />
      <Faq />
      <FinalCta />
      <StickyCta />
    </>
  );
}
