import type { Metadata } from "next";
import { Container, ButtonLink, Badge, SectionHeading } from "@/components/ui";
import { ConsultationForm } from "@/components/consultation-form";
import { site } from "@/lib/site";
import {
  ShieldCheckIcon,
  GlobeIcon,
  ChartIcon,
  UsersIcon,
  ArrowRightIcon,
  MailIcon,
  PhoneIcon,
} from "@/components/icons";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "BuildPanda is a construction and software company helping Nigerians at home and in the diaspora build with confidence. Learn about our mission, our values and how to reach us.",
  alternates: { canonical: "https://buildpanda.io/about" },
};

const values = [
  {
    icon: <ShieldCheckIcon className="h-6 w-6" />,
    title: "Trust through transparency",
    text: "We replace rumours and guesswork with verified progress, honest inspections and clear records.",
  },
  {
    icon: <ChartIcon className="h-6 w-6" />,
    title: "Accountability with money",
    text: "Funds follow verified work. We treat every naira of your budget as if it were our own.",
  },
  {
    icon: <GlobeIcon className="h-6 w-6" />,
    title: "Distance is no barrier",
    text: "We build for people who are far from the site, so visibility and communication are never an afterthought.",
  },
  {
    icon: <UsersIcon className="h-6 w-6" />,
    title: "People first",
    text: "Behind every project is a family and a dream. We manage builds with the care that deserves.",
  },
];

export default function AboutPage() {
  return (
    <>
      <section className="bg-white">
        <Container className="flex flex-col items-center gap-6 py-16 text-center sm:py-20 lg:py-24">
          <Badge>About BuildPanda</Badge>
          <h1 className="max-w-3xl text-balance text-4xl font-extrabold leading-[1.1] tracking-tight text-ink sm:text-5xl">
            We are building trust into how homes get built in Nigeria.
          </h1>
          <p className="max-w-2xl text-pretty text-lg leading-relaxed text-muted">
            BuildPanda is a construction and technology company on a mission to
            make building a home in Nigeria transparent, accountable and
            stress-free, especially for those doing it from far away.
          </p>
        </Container>
      </section>

      <section className="border-t border-line py-20 sm:py-24">
        <Container>
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="flex flex-col gap-5">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
                Our story
              </span>
              <h2 className="text-balance text-3xl font-bold leading-tight text-ink">
                Born from a simple, painful question.
              </h2>
              <div className="flex flex-col gap-4 text-base leading-relaxed text-muted">
                <p>
                  Too many people who want to build a home in Nigeria face the
                  same problem: they do not know who to trust. Money is sent,
                  promises are made, and months later the project looks nothing
                  like the plan, or the budget.
                </p>
                <p>
                  It is even harder for the diaspora. Working hard abroad to build
                  back home should be a source of pride, not anxiety. Yet the
                  distance turns every update into a leap of faith.
                </p>
                <p>
                  BuildPanda was created to change that. We combine hands-on
                  construction management with software that makes every
                  milestone, payment and inspection visible. The result is a
                  build you can follow and trust, from the first conversation to
                  the day you receive your keys.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-faint p-8">
              <h3 className="text-lg font-semibold text-ink">What we believe</h3>
              <p className="text-sm leading-relaxed text-muted">
                Building a home is one of the biggest investments a person will
                ever make. It deserves the same rigour, visibility and
                accountability as any serious project, no matter where in the
                world the owner happens to live.
              </p>
              <div className="mt-2 grid gap-3">
                <Belief text="From inception to completion and handover" />
                <Belief text="Verified work before released payments" />
                <Belief text="Independent inspections, not assumptions" />
                <Belief text="One platform, accessible from anywhere" />
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-surface-faint py-20 sm:py-24">
        <Container className="flex flex-col gap-12">
          <SectionHeading
            eyebrow="Our values"
            title="The principles behind every project we manage"
          />
          <div className="grid gap-6 sm:grid-cols-2">
            {values.map((value) => (
              <div key={value.title} className="flex gap-5 rounded-2xl border border-line bg-white p-6">
                <span className="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  {value.icon}
                </span>
                <div className="flex flex-col gap-2">
                  <h3 className="text-lg font-semibold text-ink">{value.title}</h3>
                  <p className="text-sm leading-relaxed text-muted">{value.text}</p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section id="contact" className="scroll-mt-24 py-20 sm:py-24">
        <Container>
          <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="flex flex-col gap-6">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
                Get in touch
              </span>
              <h2 className="text-balance text-3xl font-bold leading-tight text-ink sm:text-4xl">
                Let us talk about the home you want to build.
              </h2>
              <p className="text-pretty text-base leading-relaxed text-muted sm:text-lg">
                Whether you are ready to start or just exploring, reach out. We
                will listen, answer your questions and show you exactly how
                BuildPanda would manage your project.
              </p>
              <div className="flex flex-col gap-4">
                <a href={`mailto:${site.email}`} className="inline-flex items-center gap-3 text-sm font-medium text-ink hover:text-brand">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
                    <MailIcon className="h-5 w-5" />
                  </span>
                  {site.email}
                </a>
                {site.phones.map((phone) => (
                  <a key={phone} href={`tel:${phone.replace(/\s+/g, "")}`} className="inline-flex items-center gap-3 text-sm font-medium text-ink hover:text-brand">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
                      <PhoneIcon className="h-5 w-5" />
                    </span>
                    {phone}
                  </a>
                ))}
              </div>
              <div>
                <ButtonLink href="/product/" variant="outline" size="md">
                  Explore the product
                  <ArrowRightIcon className="h-5 w-5" />
                </ButtonLink>
              </div>
            </div>
            <ConsultationForm />
          </div>
        </Container>
      </section>
    </>
  );
}

function Belief({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand text-white">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12l4.5 4.5L19 7" />
        </svg>
      </span>
      <span className="text-sm font-medium text-ink">{text}</span>
    </div>
  );
}
