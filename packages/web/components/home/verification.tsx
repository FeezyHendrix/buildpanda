import { Container, ButtonLink, SectionHeading } from "@/components/ui";
import { ArrowRightIcon, ShieldCheckIcon, WalletIcon } from "@/components/icons";
import { site } from "@/lib/site";

// DECISION NEEDED: whether BuildPanda's inspection service can be called
// "independent" or "third-party" while BuildPanda also runs builds as the
// contractor on /construction. The same comment sits on
// app/construction/page.tsx and app/for-owners/page.tsx, and the decision is
// the founder's, not a copy fix. Until it is made, nothing on this page calls
// an inspection independent or third-party. It describes the mechanism the
// product actually enforces: the inspection is requested by one side of the
// contract, BuildPanda assigns the inspector, and the contractor being
// inspected can read the report and cannot change it — including when that
// contractor is BuildPanda.
//
// There is deliberately no drone column here. The word "drone" appears in no
// backend file; the only trace in the product is a checkbox in the
// project-setup wizard, which records a preference and schedules nothing.

const columns = [
  {
    icon: <ShieldCheckIcon className="h-6 w-6" />,
    label: "On the ground",
    title: "An inspection you can request",
    body: "The client or the contractor requests an inspection. BuildPanda assigns the inspector, who attends and issues the report with a pass or a fail and the findings behind it. The contractor being inspected can read the report and cannot change it, whether that contractor is you or someone you hired. Hold points stop the next operation until they clear.",
  },
  {
    icon: <WalletIcon className="h-6 w-6" />,
    label: "On the file",
    title: "Certification that follows sign-off",
    body: "A payment certificate is built from measured progress and the inspections behind it. Retention, advance recovery and what was previously certified are on the certificate, not in someone's spreadsheet.",
  },
];

export function Verification() {
  return (
    <section className="bg-surface-faint py-20 sm:py-24">
      <Container className="flex flex-col gap-12">
        <SectionHeading
          eyebrow="Verification"
          title="Someone attends the site, and the record follows what they find."
          description="Software can record a claim. It cannot see a slab. So an inspector attends, and the certificate follows what they find."
        />

        <div className="grid gap-6 md:grid-cols-2">
          {columns.map((column) => (
            <div
              key={column.title}
              className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6 sm:p-8"
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand">
                {column.icon}
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
                {column.label}
              </span>
              <h3 className="text-xl font-bold leading-tight text-ink">
                {column.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted">{column.body}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6 sm:p-8">
          <p className="text-pretty text-base leading-relaxed text-ink sm:text-lg">
            BuildPanda records money; it does not hold it or move it. What we
            give you is the thing an argument turns on: a certificate whose every
            line traces to work somebody confirmed on site, with the date they
            confirmed it. Every decision is added to the record with who made it,
            when and why, and the record is added to rather than rewritten.
          </p>
          <p className="text-sm leading-relaxed text-muted">
            This applies to both products. If you run the build, you book the
            inspection. If we run the build, we are the contractor being
            inspected: we can read the report, and we cannot change it.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={site.appUrl} size="md">
              Start free
              <ArrowRightIcon className="h-5 w-5" />
            </ButtonLink>
            <ButtonLink href="/talk-to-us/" variant="outline" size="md">
              Talk to us about an inspection
            </ButtonLink>
          </div>
          <p className="text-sm text-muted">
            Inspections are booked per visit. Ask us what a visit costs on your
            site.
          </p>
        </div>
      </Container>
    </section>
  );
}
