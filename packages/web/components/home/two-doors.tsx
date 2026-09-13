import { Container, ButtonLink, SectionHeading } from "@/components/ui";
import { site } from "@/lib/site";

// Two flat tint panels rather than two bordered cards. Equal size and equal
// weight: neither is badged as the popular one, because nothing here claims
// what other people chose.
const doors = [
  {
    number: "01",
    title: "You run the build",
    body: "Estimates and proposals, programme and delays, certificates and variations, the site diary, and the client's view.",
    who: "For contractors, developers and project managers.",
    cta: { label: "Start free", href: site.appUrl },
    note: "No card required.",
    fill: "bg-tint-brand",
  },
  {
    number: "02",
    title: "We run the build",
    body: "We scope the work, set the budget and programme, appoint and manage the trades, and report progress and spend as it happens.",
    who: "For owners and investors, including from abroad.",
    cta: { label: "Talk to us about building", href: "/talk-to-us/" },
    note: "We will say on the call whether it is a job we can take.",
    fill: "bg-tint-sky",
  },
];

export function TwoDoors() {
  return (
    <section className="bg-surface-muted py-16 sm:py-24 2xl:py-28">
      <Container className="flex flex-col gap-10 2xl:gap-14">
        <SectionHeading
          eyebrow="Two ways to work with us"
          title="One standard of proof. Two ways to get it."
          description="Some want the system. Some want the job done. We do both, and the evidence is the same either way."
        />

        <div className="flex flex-col gap-3">
          {doors.map((door) => (
            <div
              key={door.title}
              className={`${door.fill} grid gap-8 p-8 sm:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-start lg:gap-14 2xl:p-14`}
            >
              <div className="flex items-start gap-5">
                <span className="text-base font-medium tabular-nums text-ink/55">
                  {door.number}
                </span>
                <h3 className="display max-w-sm text-3xl text-ink sm:text-4xl 2xl:text-5xl">
                  {door.title}
                </h3>
              </div>

              <div className="flex flex-col gap-3">
                <p className="max-w-md text-base leading-relaxed text-ink/75 2xl:text-lg">
                  {door.body}
                </p>
                <p className="max-w-md text-sm leading-relaxed text-ink/55">
                  {door.who}
                </p>
              </div>

              <div className="flex flex-col items-start gap-3 lg:items-end">
                <ButtonLink href={door.cta.href} variant="ink" size="md">
                  {door.cta.label}
                </ButtonLink>
                <span className="max-w-[15rem] text-sm text-ink/55 lg:text-right">
                  {door.note}
                </span>
              </div>
            </div>
          ))}
        </div>

        <p className="max-w-2xl text-pretty text-base leading-relaxed text-muted 2xl:text-lg">
          &rarr; Both come with the same thing: an inspector who attends the
          site, and certificates that trace to work that was signed off.
        </p>
      </Container>
    </section>
  );
}
