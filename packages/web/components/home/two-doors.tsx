import { Container, ButtonLink, SectionHeading } from "@/components/ui";
import { site } from "@/lib/site";

// Equal weight on both doors, no "most popular" badge on either. The software
// door is first in the DOM so it is first on a phone, per the deck.
const doors = [
  {
    title: "You run the build",
    body: "Estimates and proposals, programme and delays, certificates and variations, the site diary, and the client's view.",
    who: "For contractors, developers and project managers.",
    cta: { label: "Start free", href: site.appUrl, variant: "primary" as const },
  },
  {
    title: "We run the build",
    body: "We scope the work, set the budget and programme, appoint and manage the trades, and report progress and spend as it happens.",
    who: "For owners and investors, including from abroad.",
    cta: {
      label: "Talk to us about building",
      href: "/talk-to-us/",
      variant: "outline" as const,
    },
  },
];

export function TwoDoors() {
  return (
    <section className="bg-surface-faint py-20 sm:py-24">
      <Container className="flex flex-col gap-12">
        <SectionHeading
          eyebrow="Two ways to work with us"
          title="One standard of proof. Two ways to get it."
          description="Some want the system. Some want the job done."
        />

        <div className="grid gap-6 lg:grid-cols-2">
          {doors.map((door) => (
            <div
              key={door.title}
              className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6 sm:p-8 2xl:p-10"
            >
              <h3 className="text-2xl font-bold leading-tight text-ink 2xl:text-3xl">
                {door.title}
              </h3>
              <p className="max-w-xl text-base leading-relaxed text-muted 2xl:text-lg">
                {door.body}
              </p>
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
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center">
          <p className="max-w-3xl text-pretty text-center text-base leading-relaxed text-muted sm:text-lg">
            Both come with the same thing: an inspector who attends the site,
            and certificates that trace to work that was signed off.
          </p>
        </div>
      </Container>
    </section>
  );
}
