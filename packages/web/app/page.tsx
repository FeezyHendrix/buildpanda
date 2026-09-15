import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";
import { faqJsonLd, softwareJsonLd } from "@/lib/json-ld";
import { JsonLd } from "@/components/json-ld";
import { Hero } from "@/components/home/hero";
import { TwoDoors } from "@/components/home/two-doors";
import { Objections } from "@/components/home/objections";
import { ProductShots } from "@/components/home/product-shots";
import { PandaAi } from "@/components/home/panda-ai";
import { Faq } from "@/components/home/faq";
import { StickyCta } from "@/components/home/sticky-cta";
export const metadata: Metadata = pageMetadata({
  path: "",
  title: "Construction management software",
  description: site.description,
  socialTitle: "Run every project from estimate to handover, on one system",
});
export default function HomePage() {
  return (
    <>
      <JsonLd data={[softwareJsonLd, faqJsonLd]} />
      <Hero />
      <TwoDoors />
      <Objections />
      <ProductShots />
      <PandaAi />
      <Faq />
      <StickyCta />
    </>
  );
}
