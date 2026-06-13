import type { Metadata } from "next";
import { Container, ButtonLink, Badge, SectionHeading, FeatureCard } from "@/components/ui";
import { ConsultationSection } from "@/components/consultation-section";
import { ProductMock } from "@/components/product-mock";
import { site } from "@/lib/site";
import {
  MilestoneIcon,
  WalletIcon,
  ChartIcon,
  DocumentIcon,
  ShieldCheckIcon,
  ClipboardIcon,
  SparkIcon,
  UsersIcon,
  BellIcon,
  LayersIcon,
  ArrowRightIcon,
  CheckIcon,
} from "@/components/icons";

export const metadata: Metadata = {
  title: "Product",
  description:
    "Inside BuildPanda, the Construction OS: leads, proposals and estimates, milestone payments, budget and finances, documents, third-party inspections, daily logs and AI insights. One platform to win the work and deliver it, from first enquiry to final handover.",
  alternates: { canonical: "https://buildpanda.io/product" },
};

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: site.name,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: `${site.url}/product/`,
  description:
    "The Construction OS that runs a build from first enquiry to final handover, with leads, proposals and estimates, milestones, milestone payments, budgeting, documents, inspections and on-site monitoring.",
  offers: { "@type": "Offer", availability: "https://schema.org/InStock" },
};

const deepDives = [
  {
    id: "preconstruction",
    eyebrow: "Win the work",
    title: "Leads, proposals and estimates that close",
    text: "Capture every enquiry, then turn it into a polished, line-by-line estimate and bill of quantities. Send a branded proposal your client can review and accept online, and the moment it is signed, convert it into a live project in one click.",
    points: [
      "Lead pipeline from new to won",
      "Line-by-line estimates and bills of quantities",
      "Branded proposals clients accept online",
      "One-click convert to a live project",
    ],
    icon: <ClipboardIcon className="h-6 w-6" />,
  },
  {
    id: "payments",
    eyebrow: "Money with accountability",
    title: "Milestone payments tied to verified work",
    text: "Release funds milestone by milestone, only after the work is inspected and signed off. Set the schedule of payments up front, see exactly what each release covers, and keep a clean record of where every naira has gone.",
    points: [
      "Structured payment schedule per milestone",
      "Funds released against verified progress",
      "Full payment history and receipts",
    ],
    icon: <WalletIcon className="h-6 w-6" />,
  },
  {
    id: "budget",
    eyebrow: "Stay on budget",
    title: "Budget allocation and live finances",
    text: "Allocate your budget across the project, then track spend against plan in real time. BuildPanda surfaces overruns early, so you can make decisions before small variances become expensive surprises.",
    points: [
      "Allocate budget across stages and trades",
      "Track committed and actual spend",
      "Early warnings when you drift off plan",
    ],
    icon: <ChartIcon className="h-6 w-6" />,
  },
  {
    id: "inspections",
    eyebrow: "Quality you can trust",
    title: "Independent inspections and site monitoring",
    text: "Third-party professionals inspect the work at each stage and report back with photos and findings. Combined with daily logs and drone monitoring, you get an honest, time-stamped view of the site without being there.",
    points: [
      "Third-party quality inspections per stage",
      "Photo and drone monitoring of the site",
      "Daily logs from the field",
    ],
    icon: <ShieldCheckIcon className="h-6 w-6" />,
  },
  {
    id: "documents",
    eyebrow: "Everything in order",
    title: "Documents, contracts and approvals in one place",
    text: "Keep drawings, permits, contracts and receipts organised and secure. No more lost paperwork or chasing files across email and chat. What you need is always a click away.",
    points: [
      "Secure, central document storage",
      "Drawings, permits, contracts and receipts",
      "Accessible to you wherever you are",
    ],
    icon: <DocumentIcon className="h-6 w-6" />,
  },
];

const moreFeatures = [
  {
    icon: <UsersIcon className="h-6 w-6" />,
    title: "Leads & pipeline",
    description: "Track every enquiry from new to won so nothing slips.",
  },
  {
    icon: <DocumentIcon className="h-6 w-6" />,
    title: "Proposals & BoQ",
    description: "Line-by-line estimates and bills of quantities clients accept online.",
  },
  {
    icon: <MilestoneIcon className="h-6 w-6" />,
    title: "Milestones & schedule",
    description: "A living project schedule so timelines stay realistic and visible.",
  },
  {
    icon: <ClipboardIcon className="h-6 w-6" />,
    title: "Daily logs",
    description: "Field updates that capture what happened on site, every day.",
  },
  {
    icon: <UsersIcon className="h-6 w-6" />,
    title: "Contractors & teams",
    description: "Manage contractors, roles and responsibilities in one shared workspace.",
  },
  {
    icon: <SparkIcon className="h-6 w-6" />,
    title: "AI insights",
    description: "Smart summaries that flag risks and keep you ahead of issues.",
  },
  {
    icon: <BellIcon className="h-6 w-6" />,
    title: "Notifications",
    description: "Stay informed of approvals, payments and progress as they happen.",
  },
  {
    icon: <LayersIcon className="h-6 w-6" />,
    title: "Materials tracking",
    description: "Keep tabs on materials so the right supplies arrive at the right time.",
  },
];

export default function ProductPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
      />

      <section className="bg-white">
        <Container className="flex flex-col items-center gap-6 py-16 text-center sm:py-20 lg:py-24">
          <Badge>The product</Badge>
          <h1 className="max-w-3xl text-balance text-4xl font-extrabold leading-[1.1] tracking-tight text-ink sm:text-5xl">
            The Construction OS that runs your build, end to end.
          </h1>
          <p className="max-w-2xl text-pretty text-lg leading-relaxed text-muted">
            BuildPanda brings proposals, estimates, milestones, payments,
            documents and inspections into one platform, so you win the work and
            deliver it with every decision backed by what is really happening on
            site.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/#consultation" size="lg">
              Book a consultation
              <ArrowRightIcon className="h-5 w-5" />
            </ButtonLink>
            <ButtonLink href="/construction/" variant="outline" size="lg">
              See the construction service
            </ButtonLink>
          </div>
        </Container>
      </section>

      <section className="flex flex-col gap-20 border-t border-line py-20 sm:gap-24 sm:py-24">
        {deepDives.map((item, index) => (
          <Container key={item.id}>
            <div
              id={item.id}
              className={`grid scroll-mt-24 items-center gap-10 lg:grid-cols-2 lg:gap-16 ${
                index % 2 === 1 ? "lg:[&>div:first-child]:order-2" : ""
              }`}
            >
              <div className="flex flex-col gap-5">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  {item.icon}
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
                  {item.eyebrow}
                </span>
                <h2 className="text-balance text-3xl font-bold leading-tight text-ink">
                  {item.title}
                </h2>
                <p className="text-pretty text-base leading-relaxed text-muted">
                  {item.text}
                </p>
                <ul className="flex flex-col gap-3">
                  {item.points.map((point) => (
                    <li key={point} className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                        <CheckIcon className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-sm leading-relaxed text-ink">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-3xl border border-line bg-surface-faint p-6 sm:p-8">
                <ProductMock id={item.id} />
              </div>
            </div>
          </Container>
        ))}
      </section>

      <section className="bg-surface-faint py-20 sm:py-24">
        <Container className="flex flex-col gap-12">
          <SectionHeading
            eyebrow="And more"
            title="Built for the way projects really run"
            description="Every part of BuildPanda exists to remove uncertainty and keep your project moving."
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {moreFeatures.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </Container>
      </section>

      <ConsultationSection />
    </>
  );
}
