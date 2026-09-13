import { Container, SectionHeading } from "@/components/ui";
import { ShieldCheckIcon, WalletIcon } from "@/components/icons";

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
    body: "One side requests it, BuildPanda assigns the inspector, and the report cannot be changed by the contractor it covers. Hold points stop the next operation until they clear.",
  },
  {
    icon: <WalletIcon className="h-6 w-6" />,
    label: "On the file",
    title: "Certification that follows sign-off",
    body: "A certificate is built from measured progress and the inspections behind it, with retention and advance recovery on it.",
  },
];

export function Verification() {
  return (
    <section className="bg-surface-muted py-24 sm:py-32 2xl:py-40">
      <Container className="flex flex-col gap-14 2xl:gap-20">
        <SectionHeading
          eyebrow="Verification"
          title="Someone attends the site, and the record follows what they find."
        />

        <div className="grid border-t border-hairline md:grid-cols-2">
          {columns.map((column) => (
            <div
              key={column.title}
              className="flex flex-col gap-5 border-b border-hairline py-10 pr-10 md:border-l md:pl-10 md:first:border-l-0 md:first:pl-0"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-tint-brand text-brand">
                {column.icon}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
                {column.label}
              </span>
              <h3 className="display max-w-sm text-2xl text-ink 2xl:text-3xl">
                {column.title}
              </h3>
              <p className="max-w-md text-sm leading-relaxed text-muted 2xl:text-base">
                {column.body}
              </p>
            </div>
          ))}
        </div>

        <p className="max-w-2xl text-pretty text-base leading-relaxed text-muted 2xl:text-lg">
          &rarr; BuildPanda records money, it never holds or moves it. The record
          is added to, never rewritten &mdash; including when the contractor is us.
        </p>
      </Container>
    </section>
  );
}
