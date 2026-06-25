import type { Metadata } from "next";
import {
  Container,
  ButtonLink,
  Badge,
  SectionHeading,
  FeatureCard,
} from "@/components/ui";
import { site } from "@/lib/site";
import { ConsultationSection } from "@/components/consultation-section";
import { ContractorOnboardingTimeline } from "@/components/contractor-onboarding-timeline";
import {
  UsersIcon,
  ClipboardIcon,
  LayersIcon,
  MilestoneIcon,
  WalletIcon,
  ChartIcon,
  ArrowRightIcon,
  DocumentIcon,
} from "@/components/icons";

export const metadata: Metadata = {
  title: "BuildPanda for Contractors & Builders",
  description:
    "Win more work and deliver it without the chaos. BuildPanda gives contractors the tools to capture leads, estimate accurately, and manage delivery from a single OS.",
  alternates: { canonical: "https://buildpanda.io/for-contractors" },
};

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

const deliveryFeatures = [
  {
    icon: <MilestoneIcon className="h-6 w-6" />,
    title: "Milestones & schedule",
    description:
      "Break your build into clear milestones with a live schedule of what comes next.",
  },
  {
    icon: <WalletIcon className="h-6 w-6" />,
    title: "Milestone payments",
    description:
      "Money is released against verified progress. Keep your cash flow healthy by tying funds to completed work.",
  },
  {
    icon: <ChartIcon className="h-6 w-6" />,
    title: "Budget & finances",
    description:
      "Allocate your budget, track every expense, and watch your spend against the plan with no hidden surprises.",
  },
  {
    icon: <DocumentIcon className="h-6 w-6" />,
    title: "Documents in one place",
    description:
      "Drawings, permits, contracts, and receipts are stored securely and accessible whenever you need them.",
  },
];

export default function ForContractorsPage() {
  return (
    <>
      <section className="bg-white py-16 sm:py-20 lg:py-24">
        <Container className="flex flex-col items-center text-center gap-6">
          <Badge>FOR CONTRACTORS & BUILDERS</Badge>
          <h1 className="text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-6xl max-w-4xl">
            Win more work and deliver it without the chaos.
          </h1>
          <p className="max-w-2xl text-pretty text-lg leading-relaxed text-muted">
            The Construction OS that runs your entire business. Impress clients
            with professional proposals, then manage the project, milestones,
            and finances effortlessly from a single dashboard.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row mt-4">
            {/* <ButtonLink href={site.appUrl} size="lg">
              Get started
              <ArrowRightIcon className="h-5 w-5" />
            </ButtonLink> */}
            <ButtonLink href="/talk-to-us/" variant="outline" size="lg">
              Talk to us
              <ArrowRightIcon className="h-5 w-5" />
            </ButtonLink>
          </div>
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
        </Container>
      </section>

      <section className="py-20 sm:py-24">
        <Container className="flex flex-col gap-12">
          <SectionHeading
            title="Deliver without chaos"
            description="Keep your team, your clients, and your finances perfectly aligned."
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {deliveryFeatures.map((feature) => (
              <div
                key={feature.title}
                className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-6"
              >
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  {feature.icon}
                </span>
                <h3 className="text-lg font-semibold text-ink mt-2">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted">
                  {feature.description}
                </p>
              </div>
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
