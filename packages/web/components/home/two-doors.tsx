import { Container, ButtonLink, SectionHeading } from "@/components/ui";

// Two flat tint panels side by side rather than stacked rows: the grid gives
// them equal height, so the two calls to action land on the same line. Neither
// is badged as the popular one — nothing here claims what other people chose.
const doors = [
  {
    number: "01",
    title: "You run the build",
    body: "Estimates, programme and delays, certificates and variations, the site diary, and the client's view.",
    who: "For contractors, developers and project managers.",
    cta: { label: "Software for contractors", href: "/for-contractors/" },
    fill: "bg-tint-brand",
  },
  {
    number: "02",
    title: "We run the build",
    body: "We scope it, budget it, programme it, appoint and manage the trades, and report as it happens.",
    who: "For owners and investors, on site or managing remotely.",
    cta: { label: "Our construction service", href: "/construction/" },
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
        />

        <div className="grid gap-3 lg:grid-cols-2">
          {doors.map((door) => (
            <div
              key={door.title}
              className={`${door.fill} flex flex-col gap-5 p-8 sm:p-10 2xl:p-12`}
            >
              <div className="flex items-start gap-5">
                <span className="text-base font-medium tabular-nums text-ink/55">
                  {door.number}
                </span>
                <h3 className="display text-3xl text-ink sm:text-4xl 2xl:text-5xl">
                  {door.title}
                </h3>
              </div>

              <p className="max-w-md text-base leading-relaxed text-ink/75 2xl:text-lg">
                {door.body}
              </p>
              <p className="max-w-md text-sm leading-relaxed text-ink/55">
                {door.who}
              </p>

              <div className="mt-auto pt-4">
                <ButtonLink href={door.cta.href} variant="ink" size="md">
                  {door.cta.label}
                </ButtonLink>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
