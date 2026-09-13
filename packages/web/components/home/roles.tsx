import { Container, ButtonLink, SectionHeading } from "@/components/ui";
import { site } from "@/lib/site";

const roles = [
  {
    label: "For contractors",
    title: "Get paid for what you built",
    body: "Applications that are hard to send back, and delays recorded the day they happen.",
    cta: { label: "Start free", href: site.appUrl, variant: "primary" as const },
  },
  {
    label: "For developers",
    title: "See every job without asking",
    body: "Programme, certified value and what is waiting on a decision, across the portfolio.",
    cta: { label: "Start free", href: site.appUrl, variant: "primary" as const },
  },
  {
    label: "For owners building remotely",
    title: "Know what is standing, not what you were told",
    body: "Dated progress, an inspector whose report the builder cannot change, and money against signed-off work.",
    cta: {
      label: "Talk to us about building",
      href: "/talk-to-us/",
      variant: "primary" as const,
    },
    secondary: { label: "Start free", href: site.appUrl },
  },
];

export function Roles() {
  return (
    <section className="bg-surface py-24 sm:py-32 2xl:py-40">
      <Container className="flex flex-col gap-14 2xl:gap-20">
        <SectionHeading eyebrow="Who it is for" title="Three jobs, one record." />
        <div className="grid border-t border-hairline lg:grid-cols-3">
          {roles.map((role) => (
            <div
              key={role.title}
              className="flex flex-col gap-5 border-b border-hairline py-10 pr-10 lg:border-l lg:pl-10 lg:first:border-l-0 lg:first:pl-0"
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
                {role.label}
              </span>
              <h3 className="display max-w-xs text-2xl text-ink 2xl:text-3xl">
                {role.title}
              </h3>
              <p className="max-w-sm text-sm leading-relaxed text-muted 2xl:text-base">
                {role.body}
              </p>
              <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-3 pt-4">
                <ButtonLink href={role.cta.href} variant="ink" size="md">
                  {role.cta.label}
                </ButtonLink>
                {role.secondary ? (
                  <ButtonLink href={role.secondary.href} variant="ghost" size="md">
                    {role.secondary.label}
                  </ButtonLink>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
