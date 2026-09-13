import { Container, ButtonLink, SectionHeading } from "@/components/ui";
import { ArrowRightIcon } from "@/components/icons";
import { site } from "@/lib/site";

const days = [
  {
    when: "Day 1",
    title: "Set the contract up.",
    body: "Sum, dates, retention, advance, the working week. Thirty minutes, with us on the call.",
  },
  {
    when: "Day 2",
    title: "Load the programme.",
    body: "Import your schedule or build it from the work library. We check the dependencies with you.",
  },
  {
    when: "Day 3",
    title: "Price it.",
    body: "Stage values against the contract sum, so it totals to the number in the contract.",
  },
  {
    when: "Day 4",
    title: "Put the team on.",
    body: "Site agent, QS, engineer, the client's rep. Each sees what their role should see.",
  },
  {
    when: "Day 5",
    title: "Run a day for real.",
    body: "A diary, a delay, an RFI, one inspection booked.",
  },
  {
    when: "Week 2",
    title: "First application.",
    body: "Raise it from measured progress and send it. This is where the spreadsheet stops.",
  },
];

export function GoLive() {
  return (
    <section className="bg-surface-faint py-20 sm:py-24">
      <Container className="flex flex-col gap-12">
        <SectionHeading
          eyebrow="Go-live, day by day"
          title="Running a live job by Friday."
          description="Bring one project. Not the portfolio, not the archive. One."
        />
        <ol className="mx-auto flex w-full max-w-3xl flex-col gap-3">
          {days.map((day) => (
            <li
              key={day.when}
              className="grid gap-1 rounded-2xl border border-line bg-white p-5 sm:grid-cols-[92px_minmax(0,1fr)] sm:gap-4"
            >
              <span className="text-sm font-bold uppercase tracking-wide text-brand">
                {day.when}
              </span>
              <span>
                <span className="block text-base font-semibold text-ink">
                  {day.title}
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-muted">
                  {day.body}
                </span>
              </span>
            </li>
          ))}
        </ol>
        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={site.appUrl} size="md">
              Start free
              <ArrowRightIcon className="h-5 w-5" />
            </ButtonLink>
            <ButtonLink href="/talk-to-us/" variant="outline" size="md">
              Talk to us about your first project
            </ButtonLink>
          </div>
        </div>
      </Container>
    </section>
  );
}
