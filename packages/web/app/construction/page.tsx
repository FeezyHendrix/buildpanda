import type { Metadata } from "next";
import { Container, ButtonLink, Badge, SectionHeading, FeatureCard } from "@/components/ui";
import { ConsultationSection } from "@/components/consultation-section";
import { site } from "@/lib/site";
import {
  CompassIcon,
  UsersIcon,
  ShieldCheckIcon,
  ChartIcon,
  KeyIcon,
  GlobeIcon,
  CheckIcon,
  ArrowRightIcon,
  WalletIcon,
} from "@/components/icons";

export const metadata: Metadata = {
  title: "Construction",
  description:
    "BuildPanda is the delivery side of the Construction OS: we run your build on the ground in Nigeria with verified milestone payments, independent inspections and real-time visibility, from groundbreaking to handover, on time and on budget.",
  alternates: { canonical: "https://buildpanda.io/construction" },
};

const serviceJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  serviceType: "Construction project management",
  provider: { "@type": "Organization", name: site.name, url: site.url },
  areaServed: { "@type": "Country", name: "Nigeria" },
  description:
    "Construction delivery managed on the ground with the BuildPanda Construction OS, from groundbreaking to handover, including planning, vetted contractors, verified milestone payments, independent inspections and real-time on-site monitoring.",
};

const phases = [
  {
    icon: <CompassIcon className="h-6 w-6" />,
    name: "Inception & planning",
    text: "We help you scope the project, set a realistic budget and schedule, and assemble the right professionals before work begins.",
    items: ["Scope, budget and timeline", "Design and documentation review", "Contractor selection and vetting"],
  },
  {
    icon: <ChartIcon className="h-6 w-6" />,
    name: "Construction & monitoring",
    text: "Your build is managed day to day, with progress, costs and quality tracked openly and reported back to you in real time.",
    items: ["Day-to-day site management", "Milestone payments against verified work", "Daily logs, photos and drone monitoring"],
  },
  {
    icon: <ShieldCheckIcon className="h-6 w-6" />,
    name: "Quality assurance",
    text: "Independent, third-party inspectors check the work at every stage, so quality is confirmed by professionals, not assumed.",
    items: ["Third-party inspections per stage", "Issues flagged and resolved early", "Honest, documented reporting"],
  },
  {
    icon: <KeyIcon className="h-6 w-6" />,
    name: "Completion & handover",
    text: "We close out the project, confirm everything is done to standard, settle final payments and hand over your finished home.",
    items: ["Final sign-off and snagging", "Closeout of payments and documents", "Keys and handover pack"],
  },
];

const promises = [
  "A single point of accountability for your project",
  "Vetted, qualified contractors and professionals",
  "Independent inspections at every stage",
  "Payments released only against verified progress",
  "A live dashboard you can follow from anywhere",
  "Clear, honest reporting with no hidden costs",
];

export default function ConstructionPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />

      <section className="bg-white">
        <Container className="flex flex-col items-center gap-6 py-16 text-center sm:py-20 lg:py-24">
          <Badge>Construction, managed and verified</Badge>
          <h1 className="max-w-3xl text-balance text-4xl font-extrabold leading-[1.1] tracking-tight text-ink sm:text-5xl">
            A true partner on the ground, from groundbreaking to handover.
          </h1>
          <p className="max-w-2xl text-pretty text-lg leading-relaxed text-muted">
            BuildPanda runs your build in Nigeria and streams every milestone,
            payment and inspection to your screen. A real partner on site, with
            the Construction OS keeping the work on time, on budget and verified
            at every stage.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/#consultation" size="lg">
              Book a consultation
              <ArrowRightIcon className="h-5 w-5" />
            </ButtonLink>
            <ButtonLink href="/product/" variant="outline" size="lg">
              See the software
            </ButtonLink>
          </div>
        </Container>
      </section>

      <section className="border-t border-line py-20 sm:py-24">
        <Container className="flex flex-col gap-12">
          <SectionHeading
            eyebrow="A true partner on the ground"
            title="We run the build. You see everything."
            description="BuildPanda pairs hands-on construction management with the Construction OS, so your project moves on time, on budget and in full view."
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<WalletIcon className="h-6 w-6" />}
              title="Payments tied to verified work"
              description="Funds are released milestone by milestone, only after independent inspectors sign the work off. Every naira stays tied to progress you can see."
            />
            <FeatureCard
              icon={<ChartIcon className="h-6 w-6" />}
              title="Tech-enabled site management"
              description="The Construction OS keeps every phase, contractor and milestone on track, with costs and schedule updated as the work actually happens."
            />
            <FeatureCard
              icon={<GlobeIcon className="h-6 w-6" />}
              title="Real-time visibility, anywhere"
              description="Daily logs, photos and progress stream to your dashboard, so you always know what is happening on site without flying in."
            />
          </div>
        </Container>
      </section>

      <section className="border-t border-line py-20 sm:py-24">
        <Container className="flex flex-col gap-12">
          <SectionHeading
            eyebrow="How we manage it"
            title="A clear, accountable process at every phase"
            description="From a signed proposal to the final handover, every phase is managed, costed and inspected, so your build stays on time and on budget."
          />
          <div className="grid gap-6 lg:grid-cols-2">
            {phases.map((phase, index) => (
              <div key={phase.name} className="flex flex-col gap-5 rounded-2xl border border-line bg-white p-7">
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    {phase.icon}
                  </span>
                  <span className="text-sm font-bold text-line">0{index + 1}</span>
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-xl font-semibold text-ink">{phase.name}</h3>
                  <p className="text-sm leading-relaxed text-muted">{phase.text}</p>
                </div>
                <ul className="flex flex-col gap-3 border-t border-line pt-5">
                  {phase.items.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                        <CheckIcon className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-sm leading-relaxed text-ink">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-surface-faint py-20 sm:py-24">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="flex flex-col gap-5">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                <GlobeIcon className="h-5 w-5" />
                Building from the diaspora
              </span>
              <h2 className="text-balance text-3xl font-bold leading-tight text-ink sm:text-4xl">
                You found us because you did not know who to trust. That ends here.
              </h2>
              <p className="text-pretty text-base leading-relaxed text-muted sm:text-lg">
                Many of the people we work with live abroad and want to build back
                home. They have heard the horror stories: stalled projects,
                inflated costs, work that does not match the money sent.
                BuildPanda exists to make that fear obsolete. We are your eyes,
                hands and accountability on the ground.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {promises.map((promise) => (
                <div key={promise} className="flex items-start gap-3 rounded-xl border border-line bg-white p-4">
                  <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                    <CheckIcon className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-sm leading-relaxed text-ink">{promise}</span>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <section className="py-20 sm:py-24">
        <Container className="flex flex-col gap-12">
          <SectionHeading
            eyebrow="Who we build for"
            title="Whatever you are building, we manage it the same careful way"
          />
          <div className="grid gap-6 md:grid-cols-3">
            <Audience icon={<KeyIcon className="h-6 w-6" />} title="New homes" text="Build a new family home from the ground up, managed end to end." />
            <Audience icon={<CompassIcon className="h-6 w-6" />} title="Renovations" text="Renovate or extend an existing property with full cost control." />
            <Audience icon={<UsersIcon className="h-6 w-6" />} title="Investments" text="Develop property as an investment with transparent oversight." />
          </div>
        </Container>
      </section>

      <ConsultationSection />
    </>
  );
}

function Audience({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand">
        {icon}
      </span>
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <p className="text-sm leading-relaxed text-muted">{text}</p>
    </div>
  );
}
