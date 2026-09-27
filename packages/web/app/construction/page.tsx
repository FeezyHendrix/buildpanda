import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { breadcrumbJsonLd } from "@/lib/json-ld";
import { JsonLd } from "@/components/json-ld";
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

export const metadata: Metadata = pageMetadata({
  path: "construction",
  title: "Managed construction service",
  description:
    "BuildPanda manages your construction project, from scope and budget to site delivery. Stay informed with clear progress, cost and inspection records.",
  socialTitle: "We run the build, and report it to you as it happens",
});

const serviceJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  serviceType: "Construction project management",
  provider: { "@type": "Organization", name: site.name, url: site.url },
  description:
    "A managed construction service run on the BuildPanda software, covering planning, day-to-day site management, inspections you can request, daily site reporting, and a payment record that traces back to work that was signed off.",
};

const phases = [
  {
    icon: <CompassIcon className="h-6 w-6" />,
    name: "Inception & planning",
    text: "We help you scope the project, set a realistic budget and schedule, and assemble the right professionals before work begins.",
    items: ["Scope, budget and timeline", "Design and documentation review", "Contractor selection"],
  },
  {
    icon: <ChartIcon className="h-6 w-6" />,
    name: "Construction & monitoring",
    text: "Your build is managed day to day, with progress, costs and quality tracked openly and reported back to you.",
    items: ["Day-to-day site management", "Payment certificates against signed-off work", "Daily logs and site photos"],
  },
  {
    icon: <ShieldCheckIcon className="h-6 w-6" />,
    name: "Inspections",
    text: "An inspection is a job you ask for. A BuildPanda inspector attends and writes the report. The contractor being inspected can read that report and cannot change it.",
    items: ["Inspections you request, at the stages you choose", "A pass or fail outcome with findings and photos", "A re-inspection date when work has to be redone"],
  },
  {
    icon: <KeyIcon className="h-6 w-6" />,
    name: "Completion",
    text: "We close the project out with you. The final work is signed off and you keep the full record of what was built, certified and paid.",
    items: ["Client sign-off on the final work", "The full certification and payment record", "Every drawing and document handed over"],
  },
];

const promises = [
  "A single point of accountability for your project",
  "Inspections you can request at any stage",
  "A payment record that traces back to work that was signed off",
  "A live dashboard you can follow from anywhere",
  "Clear, honest reporting with no hidden costs",
];

export default function ConstructionPage() {
  return (
    <>
    <JsonLd data={breadcrumbJsonLd([{ name: "Construction service", path: "construction" }])} />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />

      <section className="bg-white">
        <Container className="flex flex-col items-center gap-6 py-16 text-center sm:py-20 lg:py-24">
          <Badge>Our managed construction service</Badge>
          <h1 className="max-w-3xl text-balance text-4xl font-extrabold leading-[1.1] tracking-tight text-ink sm:text-5xl">
            A true partner on the ground, from groundbreaking to completion.
          </h1>
          <p className="max-w-2xl text-pretty text-lg leading-relaxed text-muted">
            This is our managed construction service. BuildPanda runs your build,
            and every stage, payment certificate and inspection report goes on
            the record where you can read it. If you would rather run your own
            build, that is the software.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/talk-to-us/" size="lg">
              Book a consultation
              <ArrowRightIcon className="h-5 w-5" />
            </ButtonLink>
            <ButtonLink href="/for-owners/" variant="outline" size="lg">
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
            description="BuildPanda pairs hands-on construction management with the software, so your project moves on time, on budget and in full view."
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* DECISION NEEDED: BuildPanda runs the build on this page and also
                assigns the inspector on an inspection request. Until the founder
                decides whether the inspection service is a separate,
                separately-branded business, this copy must not call an
                inspection "independent" or "third-party". It says only what is
                true of the product: the client's request engages the inspector,
                and the contractor being inspected cannot change the report. */}
            <FeatureCard
              icon={<WalletIcon className="h-6 w-6" />}
              title="Payments tied to signed-off work"
              description="Every payment certificate traces back to work that was signed off. We record what was certified and what was paid. The money moves through your own bank."
            />
            <FeatureCard
              icon={<ChartIcon className="h-6 w-6" />}
              title="Tech-enabled site management"
              description="The software keeps every phase, contractor and key date on track, with costs and schedule updated as the work actually happens."
            />
            <FeatureCard
              icon={<GlobeIcon className="h-6 w-6" />}
              title="Real-time visibility, anywhere"
              description="Daily logs, photos and progress stream to your dashboard, so you can follow what is happening without being on site."
            />
          </div>
        </Container>
      </section>

      <section className="border-t border-line py-20 sm:py-24">
        <Container className="flex flex-col gap-12">
          <SectionHeading
            eyebrow="How we manage it"
            title="A clear, accountable process at every phase"
            description="From a signed proposal to the final sign-off, every phase is managed, costed and inspected, so your build stays on time and on budget."
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
                Building from a distance
              </span>
              <h2 className="text-balance text-3xl font-bold leading-tight text-ink sm:text-4xl">
                You found us because you did not know who to trust. That ends here.
              </h2>
              <p className="text-pretty text-base leading-relaxed text-muted sm:text-lg">
                Managing a build from a distance can make it difficult to verify
                progress, costs and quality. BuildPanda keeps you connected to
                the site with clear updates, inspection reports and payment
                records. We are your eyes, hands and accountability on the ground.
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
