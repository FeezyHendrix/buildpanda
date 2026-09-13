import type { Metadata } from "next";
import { Container, ButtonLink, Badge, SectionHeading, FeatureCard } from "@/components/ui";
import { site } from "@/lib/site";
import { HeroVisual } from "@/components/hero-visual";
// import { ConsultationSection } from "@/components/consultation-section";
import {
  MilestoneIcon,
  WalletIcon,
  ChartIcon,
  DocumentIcon,
  ArrowRightIcon,
  GlobeIcon,
  CompassIcon,
  KeyIcon,
  UsersIcon,
  ClipboardIcon,
} from "@/components/icons";

export const metadata: Metadata = {
  title: "BuildPanda: the Construction OS for modern builders",
  description:
    "BuildPanda is the software your build runs on. Win work with proposals and estimates, then run the job with a live schedule, inspections and a payment record that traces back to work that was signed off.",
  alternates: { canonical: "https://buildpanda.io" },
};

const stages = [
  {
    icon: <CompassIcon className="h-6 w-6" />,
    title: "Win the work",
    text: "Capture leads, send branded proposals and price accurate estimates that turn enquiries into signed jobs.",
  },
  {
    icon: <ChartIcon className="h-6 w-6" />,
    title: "Build & monitor",
    text: "Convert the signed proposal into a project, then follow daily progress, costs and inspection reports as they are filed.",
  },
  {
    icon: <KeyIcon className="h-6 w-6" />,
    title: "Completion",
    text: "Sign off the final work and keep the full record of what was built, certified and paid.",
  },
];

const features = [
  {
    icon: <UsersIcon className="h-6 w-6" />,
    title: "Leads & pipeline",
    description: "Capture every enquiry and track it from new to won so no opportunity is lost.",
  },
  {
    icon: <ClipboardIcon className="h-6 w-6" />,
    title: "Proposals & estimates",
    description: "Build precise estimates and send branded proposals your clients can accept online.",
  },
  {
    icon: <MilestoneIcon className="h-6 w-6" />,
    title: "Milestones & schedule",
    description: "Break your build into clear milestones with a live schedule of what comes next.",
  },
  {
    icon: <WalletIcon className="h-6 w-6" />,
    title: "Payment records",
    description: "Every payment certificate traces back to work that was signed off. The money moves through your own bank.",
  },
  {
    icon: <ChartIcon className="h-6 w-6" />,
    title: "Budget & finances",
    description: "Allocate budget, track expenses, and watch your spend against the plan.",
  },
  {
    icon: <DocumentIcon className="h-6 w-6" />,
    title: "On-site monitoring",
    description: "Site photos and daily logs bring the site directly to your screen.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden bg-white">
        <Container className="grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:py-24">
          <div className="flex flex-col items-start gap-6">
            <Badge>The Construction OS for builders</Badge>
            <h1 className="text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-6xl">
              The Construction OS, from first enquiry to final handover.
            </h1>
            <p className="max-w-xl text-pretty text-lg leading-relaxed text-muted">
              BuildPanda is the software your build runs on. Win the work with
              proposals and accurate estimates, convert a signed deal into a live
              project, then run the schedule, the payment record and the
              inspections from one dashboard.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={site.appUrl} size="lg">
                Get started
                <ArrowRightIcon className="h-5 w-5" />
              </ButtonLink>
              <ButtonLink href="/talk-to-us/" variant="outline" size="lg">
                Talk to us
              </ButtonLink>
            </div>
            <p className="text-sm text-muted">
              No obligation. Someone from the BuildPanda team responds within one business day.
            </p>
          </div>
          <HeroVisual />
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container className="flex flex-col items-center gap-10">
          <SectionHeading
            eyebrow="See it in action"
            title="Your whole build, in under half a minute"
            description="Watch BuildPanda go from first enquiry to a signed proposal and a live construction project."
          />
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-line bg-white shadow-xl">
            <video
              className="aspect-video w-full"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster="/demo-poster.jpg"
            >
              <source src="/demo.mp4" type="video/mp4" />
            </video>
          </div>
        </Container>
      </section>

      <section className="border-y border-line bg-white py-6">
        <Container>
          <div className="grid gap-6 text-center sm:grid-cols-3">
            <Stat value="Enquiry to handover" label="One OS for the entire build" />
            <Stat value="Win more work" label="Proposals and estimates that close" />
            <Stat value="Signed-off progress" label="Every payment record traces back to the work" />
          </div>
        </Container>
      </section>

      <section className="py-20 sm:py-24">
        <Container className="flex flex-col gap-12">
          <SectionHeading
            eyebrow="The problem"
            title="Building should not mean flying blind."
            description="Stop sending money and waiting in the dark. BuildPanda replaces guesswork with a single record of what was built, certified and paid."
          />
          <div className="grid gap-6 md:grid-cols-3">
            <Pain title="No more guessing" text="See real progress, real costs and real inspection results instead of relying on word of mouth." />
            <Pain title="No more unexplained payments" text="You pay against verified progress, and the record shows what it was paid for." />
            <Pain title="No more unclear responsibility" text="Every person on the project has a named role, so you know who did what and when." />
          </div>
        </Container>
      </section>

      <section className="bg-surface-faint py-20 sm:py-24">
        <Container className="flex flex-col gap-12">
          <SectionHeading
            eyebrow="How it works"
            title="One clear path from first enquiry to a closed job"
            description="BuildPanda covers every phase, from winning the work to closing the job out, with the same record open to everyone on it."
          />
          <div className="grid gap-6 md:grid-cols-3">
            {stages.map((stage, index) => (
              <div key={stage.title} className="relative flex flex-col gap-4 rounded-2xl border border-line bg-white p-6">
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    {stage.icon}
                  </span>
                  <span className="text-sm font-bold text-line">0{index + 1}</span>
                </div>
                <h3 className="text-lg font-semibold text-ink">{stage.title}</h3>
                <p className="text-sm leading-relaxed text-muted">{stage.text}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-20 sm:py-24">
        <Container className="flex flex-col gap-12">
          <SectionHeading
            eyebrow="What BuildPanda does"
            title="Everything you need to run a build, in one place"
            description="From winning the work to closing the job out, these are the tools your build runs on."
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
          <div className="flex justify-center">
            <ButtonLink href="/for-contractors/" variant="outline" size="md">
              See what you can do
              <ArrowRightIcon className="h-5 w-5" />
            </ButtonLink>
          </div>
        </Container>
      </section>

      <section className="bg-ink py-20 sm:py-24">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
            <div className="flex flex-col gap-5">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-white/70">
                <GlobeIcon className="h-5 w-5" />
                For the diaspora
              </span>
              <h2 className="text-balance text-3xl font-bold leading-tight text-white sm:text-4xl">
                Thousands of kilometres away, fully in control.
              </h2>
              <p className="text-pretty text-base leading-relaxed text-white/70 sm:text-lg">
                Building from abroad? This is our managed construction service, where BuildPanda runs the build on the ground and you follow it in the software.
              </p>
              <div>
                <ButtonLink href="/construction/" variant="white" size="md">
                  See how we manage your build
                  <ArrowRightIcon className="h-5 w-5" />
                </ButtonLink>
              </div>
            </div>
            <div className="grid gap-4">
              <DarkPoint text="A named project team, with every role on the record" />
              <DarkPoint text="Inspections you can request, reported by the inspector who attended" />
              <DarkPoint text="You pay against verified progress, and the record shows what it was paid for" />
              <DarkPoint text="Live updates across every time zone" />
            </div>
          </div>
        </Container>
      </section>

      {/* <ConsultationSection /> */}
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-base font-bold text-ink">{value}</span>
      <span className="text-sm text-muted">{label}</span>
    </div>
  );
}

function Pain({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-6">
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <p className="text-sm leading-relaxed text-muted">{text}</p>
    </div>
  );
}

function DarkPoint({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-4">
      <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand text-white">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12l4.5 4.5L19 7" />
        </svg>
      </span>
      <span className="text-sm text-white/90">{text}</span>
    </div>
  );
}
