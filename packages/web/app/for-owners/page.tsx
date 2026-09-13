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
import { site } from "@/lib/site";
import { ConsultationSection } from "@/components/consultation-section";
import { OnboardingTimeline } from "@/components/onboarding-timeline";
import {
  ShieldCheckIcon,
  ClipboardIcon,
  MilestoneIcon,
  WalletIcon,
  ChartIcon,
  ArrowRightIcon,
  DocumentIcon,
} from "@/components/icons";

export const metadata: Metadata = pageMetadata({
  path: "for-owners",
  title: "Construction software for developers and project owners",
  description:
    "Follow a build you are paying for. See progress against the programme, request an inspection at any stage, and read a payment record that traces back to work that was signed off. Start free, no card.",
  socialTitle: "Owners: see what you are paying for, stage by stage",
});

const visibilityFeatures = [
  {
    icon: <ClipboardIcon className="h-6 w-6" />,
    title: "On-site monitoring",
    description:
      "Site photos and daily logs bring the site directly to your screen.",
  },
  {
    icon: <ShieldCheckIcon className="h-6 w-6" />,
    // DECISION NEEDED: whether BuildPanda's inspection service can be called
    // "independent" while BuildPanda also runs builds as the contractor on
    // /construction. Until that is decided this copy states only what the
    // product does: the client requests, BuildPanda assigns the inspector, and
    // the contractor being inspected cannot edit the report.
    title: "Inspections",
    description:
      "Request an inspection and a BuildPanda inspector attends and writes the report. The contractor being inspected can read it and cannot change it.",
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
    title: "Payment records",
    description:
      "You pay against verified progress, and the record shows what it was paid for. The money moves through your own bank.",
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
    <JsonLd data={breadcrumbJsonLd([{ name: "For owners", path: "for-owners" }])} />
      <section className="bg-white py-16 sm:py-20 lg:py-24">
        <Container className="flex flex-col items-center text-center gap-6">
          <Badge>FOR OWNERS & CLIENTS</Badge>
          <h1 className="text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-6xl max-w-4xl">
            Build with total visibility and control, even from afar.
          </h1>
          <p className="max-w-2xl text-pretty text-lg leading-relaxed text-muted">
            This is the BuildPanda software, for the client on a construction
            contract. Whether you live around the corner or thousands of miles
            away, you see what has been built, what has been certified and what
            has been paid.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row mt-4">
            {/* <ButtonLink href={site.appUrl} size="lg">
              Start free
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
            description="See every expense, and pay against work that has been signed off. BuildPanda records what was certified and what was paid."
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
            title="From enquiry to project delivery"
            description="A simple, structured journey from your first conversation to a successfully completed build."
          />
          <OnboardingTimeline />
        </Container>
      </section>
    </>
  );
}
