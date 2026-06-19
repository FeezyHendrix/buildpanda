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
import { OnboardingTimeline } from "@/components/onboarding-timeline";
import {
  ShieldCheckIcon,
  DroneIcon,
  MilestoneIcon,
  WalletIcon,
  ChartIcon,
  ArrowRightIcon,
  DocumentIcon,
} from "@/components/icons";

export const metadata: Metadata = {
  title: "BuildPanda for Project Owners",
  description:
    "Build with total visibility and control, even from thousands of miles away. Get real-time progress, independent inspections, and milestone-based payments.",
  alternates: { canonical: "https://buildpanda.io/for-owners" },
};

const visibilityFeatures = [
  {
    icon: <DroneIcon className="h-6 w-6" />,
    title: "On-site & drone monitoring",
    description:
      "Photos, daily logs, and high-resolution drone surveys bring the site directly to your screen.",
  },
  {
    icon: <ShieldCheckIcon className="h-6 w-6" />,
    title: "Independent inspections",
    description:
      "Third-party quality checks at each stage give you an honest, professional view of the work on the ground.",
  },
  {
    icon: <MilestoneIcon className="h-6 w-6" />,
    title: "Milestones & schedule",
    description:
      "Follow the build through clear milestones with a live schedule of what comes next.",
  },
];

const financialFeatures = [
  {
    icon: <WalletIcon className="h-6 w-6" />,
    title: "Milestone payments",
    description:
      "Money is released against verified progress, not promises. Your funds stay tied to work that has actually been done.",
  },
  {
    icon: <ChartIcon className="h-6 w-6" />,
    title: "Budget & finances",
    description:
      "Track every expense and watch your spend against the plan with no hidden surprises.",
  },
  {
    icon: <DocumentIcon className="h-6 w-6" />,
    title: "Documents in one place",
    description:
      "Drawings, permits, contracts, and receipts are stored securely and accessible whenever you need them.",
  },
];

export default function ForOwnersPage() {
  return (
    <>
      <section className="bg-white py-16 sm:py-20 lg:py-24">
        <Container className="flex flex-col items-center text-center gap-6">
          <Badge>FOR OWNERS & CLIENTS</Badge>
          <h1 className="text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-6xl max-w-4xl">
            Build with total visibility and control, even from afar.
          </h1>
          <p className="max-w-2xl text-pretty text-lg leading-relaxed text-muted">
            Whether you live around the corner or thousands of miles away,
            BuildPanda gives you a live window into your project and ensures
            your money only moves when verified work is complete.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row mt-4">
            <ButtonLink href={site.appUrl} size="lg">
              Get started
              <ArrowRightIcon className="h-5 w-5" />
            </ButtonLink>
            <ButtonLink href="/talk-to-us/" variant="outline" size="lg">
              Talk to us
            </ButtonLink>
          </div>
        </Container>
      </section>

      <section className="bg-surface-faint py-20 sm:py-24">
        <Container className="flex flex-col gap-12">
          <SectionHeading
            title="Visibility & trust"
            description="Replace guesswork with a single source of truth. See exactly what is happening on your site in real time."
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visibilityFeatures.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </Container>
      </section>

      <section className="py-20 sm:py-24">
        <Container className="flex flex-col gap-12">
          <SectionHeading
            title="Financial control"
            description="Protect your funds. Pay only for verified progress, with full transparency into every expense."
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {financialFeatures.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-surface-faint py-20 sm:py-24">
        <Container className="flex flex-col gap-12">
          <SectionHeading
            eyebrow="How it works"
            title="From Inquiry to Project Delivery"
            description="A simple, structured journey from your first conversation to a successfully completed build."
          />
          <OnboardingTimeline />
        </Container>
      </section>
    </>
  );
}
