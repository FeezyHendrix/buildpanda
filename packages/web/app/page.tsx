import type { Metadata } from "next";
import { Hero } from "@/components/home/hero";
import { TwoDoors } from "@/components/home/two-doors";
import { Objections } from "@/components/home/objections";
import { Verification } from "@/components/home/verification";
import { SoftwareJobs } from "@/components/home/software-jobs";
import { WhereYouWork } from "@/components/home/where-you-work";
import { Roles } from "@/components/home/roles";
import { GoLive } from "@/components/home/go-live";
import { Faq } from "@/components/home/faq";
import { FinalCta } from "@/components/home/final-cta";
import { StickyCta } from "@/components/home/sticky-cta";

const title = "BuildPanda: verified construction delivery";
const description =
  "Run your own build on BuildPanda, or have us build it. Inspections on site, a record that carries who decided what and when, and payment certificates that trace to work that was signed off. For contractors, developers and owners.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://buildpanda.io" },
  openGraph: { title, description },
  twitter: { title, description },
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <TwoDoors />
      <Objections />
      <Verification />
      <SoftwareJobs />
      <WhereYouWork />
      <Roles />
      <GoLive />
      <Faq />
      <FinalCta />
      <StickyCta />
    </>
  );
}
