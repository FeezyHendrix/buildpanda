import { Container, ButtonLink, SectionHeading } from "@/components/ui";
import { site } from "@/lib/site";

// Equal weight on both doors, no "most popular" badge on either. The software
// door is first in the DOM so it is first on a phone, per the deck.
const doors = [
  {
    label: "Product one · software",
    title: "You run the build",
    body: "Your team, your subcontractors, your programme. BuildPanda is the system you run it on: estimates and proposals, programme and delays, certificates and variations, the site diary, and the client's view.",
    who: "For contractors, developers and project managers running one to fifty jobs.",
    cta: { label: "Start free", href: site.appUrl, variant: "primary" as const },
    note: "No card required.",
  },
  {
    label: "Product two · build service",
    title: "We run the build",
    body: "We scope the work, set the budget and programme, appoint and manage the trades, and report progress and spend to you as it happens. You get the same record a contractor would keep, without having to keep it.",
    who: "For owners and investors who do not want to run a site, including from abroad.",
    cta: {
      label: "Talk to us about building",
      href: "/talk-to-us/",
      variant: "outline" as const,
    },
    note: "We will tell you on the call whether your job is one we can take.",
  },
];

export function TwoDoors() {
  return (
    <section className="bg-surface-faint py-20 sm:py-24">
      <Container className="flex flex-col gap-12">
        <SectionHeading
          eyebrow="Two ways to work with us"
          title="One standard of proof. Two ways to get it."
          description="Some contractors want the system. Some clients want the job done. We do both, and the evidence is the same either way."
        />

        <div className="grid gap-6 lg:grid-cols-2">
          {doors.map((door) => (
            <div
              key={door.title}
              className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6 sm:p-8"
            >
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
                {door.label}
              </span>
              <h3 className="text-2xl font-bold leading-tight text-ink">
                {door.title}
              </h3>
              <p className="text-base leading-relaxed text-muted">{door.body}</p>
              <p className="text-sm leading-relaxed text-muted">{door.who}</p>
              <div className="mt-auto flex flex-col gap-3 pt-2">
                <ButtonLink
                  href={door.cta.href}
                  variant={door.cta.variant}
                  size="md"
                  className="w-full sm:w-auto sm:self-start"
                >
                  {door.cta.label}
                </ButtonLink>
                <p className="text-sm text-muted">{door.note}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-6 sm:p-8">
          <p className="text-pretty text-base leading-relaxed text-ink sm:text-lg">
            Both come with the same thing: an inspector who attends the site and
            writes the report, a record that is added to rather than rewritten,
            and payment certificates that trace to work that was signed off.
          </p>
          <p className="text-sm leading-relaxed text-muted">
            Not sure which you need? Start free and tell us about the job. If it
            is one we should build, we will say so.
          </p>
        </div>
      </Container>
    </section>
  );
}
