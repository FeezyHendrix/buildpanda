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
    <section className="py-20 sm:py-24">
      <Container className="flex flex-col gap-12">
        <SectionHeading
          eyebrow="Who it is for"
          title="Three jobs, one record."
        />
        <div className="grid gap-6 lg:grid-cols-3">
          {roles.map((role) => (
            <div
              key={role.title}
              className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6"
            >
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
                {role.label}
              </span>
              <h3 className="text-xl font-bold leading-snug text-ink">
                {role.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted">{role.body}</p>
              <div className="mt-auto flex flex-col gap-2 pt-2">
                <ButtonLink
                  href={role.cta.href}
                  variant={role.cta.variant}
                  size="md"
                  className="w-full"
                >
                  {role.cta.label}
                </ButtonLink>
                {role.secondary ? (
                  <ButtonLink
                    href={role.secondary.href}
                    variant="outline"
                    size="md"
                    className="w-full"
                  >
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
