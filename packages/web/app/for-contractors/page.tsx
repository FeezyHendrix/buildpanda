import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { breadcrumbJsonLd } from "@/lib/json-ld";
import { JsonLd } from "@/components/json-ld";
import {
  Container,
  ButtonLink,
  Badge,
  SectionHeading,
  FeatureCard,
} from "@/components/ui";
import { ConsultationSection } from "@/components/consultation-section";
import { ContractorOnboardingTimeline } from "@/components/contractor-onboarding-timeline";
import { ProductScreenshot } from "@/components/product-screenshot";
import { ProductWalkthrough } from "@/components/product-walkthrough";
import {
  UsersIcon,
  ClipboardIcon,
  LayersIcon,
} from "@/components/icons";

export const metadata: Metadata = pageMetadata({
  path: "for-contractors",
  title: "Construction management software for contractors",
  description:
    "Manage estimates, construction schedules, site diaries and payment certificates with BuildPanda software for contractors. Book a demo for your next project.",
  socialTitle: "Contractors: run the build and keep the record that proves it",
});

const winWorkFeatures = [
  {
    icon: <UsersIcon className="h-6 w-6" />,
    title: "Leads & pipeline",
    description:
      "Capture every enquiry and track it from new to won so no opportunity is lost.",
  },
  {
    icon: <ClipboardIcon className="h-6 w-6" />,
    title: "Proposals & estimates",
    description:
      "Build precise, line-by-line estimates and bills of quantities. Send branded proposals clients can accept online.",
  },
  {
    icon: <LayersIcon className="h-6 w-6" />,
    title: "One-click handoff",
    description:
      "Turn an accepted proposal into a live construction project instantly, with budget and milestones ready to go.",
  },
];

const preconstructionScreens = [
  {
    src: "/product/boq.png",
    alt: "BuildPanda bill of quantities with grouped work items, quantities, units and an action to price them into an estimate",
    title: "Build an estimate from the bill of quantities",
    description:
      "Keep the scope, quantities and units together, then price the work into an estimate for your proposal.",
  },
  {
    src: "/product/client-proposal.png",
    alt: "A branded BuildPanda client proposal showing the project brief and an itemised estimate with quantities, rates and totals",
    title: "Show the client exactly what you are pricing",
    description:
      "Share a branded proposal with the project brief and a clear breakdown of the work, quantities, rates and totals.",
  },
];

const deliveryScreens = [
  {
    src: "/product/programme.jpg",
    alt: "BuildPanda construction programme with a Gantt chart, recorded delays, delay costs and a revised completion date",
    title: "Milestones, schedules and delays",
    description:
      "See the programme, record delays and follow their effect on the completion date and cost of the job.",
  },
  {
    src: "/product/finance.jpg",
    alt: "BuildPanda finance overview showing contract value, variations, certified work, payments and retention",
    title: "Payment records and project finances",
    description:
      "Track variations, certified work, payments and retention against the contract. Every total has a record behind it.",
  },
  {
    src: "/product/daily-log.jpg",
    alt: "BuildPanda site diary listing daily weather, crew, working hours and the activities completed on site",
    title: "Site diaries and daily reports",
    description:
      "Capture weather, crew and hours against the day's activities, so site progress stays in the project record.",
  },
  {
    src: "/product/plans.jpg",
    alt: "A construction drawing in BuildPanda with drawing scale, markup tools and a panel for review notes",
    title: "Drawings and review notes together",
    description:
      "Open a drawing, measure from its scale and add markups and review notes where the team can find them.",
  },
];

export default function ForContractorsPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "For contractors", path: "for-contractors" }])} />
      <section className="bg-white py-16 sm:py-20 lg:py-24">
        <Container className="flex flex-col items-center text-center gap-6">
          <Badge>FOR CONTRACTORS & BUILDERS</Badge>
          <h1 className="text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-6xl max-w-4xl">
            Win more work and deliver it without the chaos.
          </h1>
          <p className="max-w-2xl text-pretty text-lg leading-relaxed text-muted">
            This is the software you run your own builds on. Win work with
            professional proposals, then manage the project, the schedule and
            the finances from a single dashboard.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row mt-4">
            <ButtonLink href="/talk-to-us/" size="lg">
              Book a demo
            </ButtonLink>
            <ButtonLink href="#product-tour" variant="outline" size="lg">
              Watch the product tour
            </ButtonLink>
          </div>
          <ProductWalkthrough />
        </Container>
      </section>

      <section className="bg-surface-faint py-20 sm:py-24">
        <Container className="flex flex-col gap-12">
          <SectionHeading
            title="Win the work"
            description="Give your clients a polished, professional experience from their very first enquiry."
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {winWorkFeatures.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {preconstructionScreens.map((screen) => (
              <ProductScreenshot key={screen.src} {...screen} width={1500} height={940} />
            ))}
          </div>
        </Container>
      </section>

      <section className="py-20 sm:py-24">
        <Container className="flex flex-col gap-12">
          <SectionHeading
            title="Deliver without chaos"
            description="See how the programme, finances, daily reports and drawings connect. Select any screenshot to view it at full size."
          />
          <div className="grid gap-6 lg:grid-cols-2">
            {deliveryScreens.map((screen) => (
              <ProductScreenshot key={screen.src} {...screen} width={2468} height={1542} />
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-surface-faint py-20 sm:py-24">
        <Container className="flex flex-col gap-12">
          <SectionHeading
            eyebrow="Onboarding Process"
            title="From enquiry to project delivery"
            description="Getting started with BuildPanda is straightforward. Here is exactly what happens from your first conversation to your first delivered project."
          />
          <ContractorOnboardingTimeline />
        </Container>
      </section>

      <ConsultationSection />
    </>
  );
}
