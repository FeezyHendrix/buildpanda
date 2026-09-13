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
    <section className="bg-surface py-24 sm:py-32 2xl:py-40">
      <Container className="flex flex-col gap-14 2xl:gap-20">
        <SectionHeading
          eyebrow="Go-live, day by day"
          title="Running a live job by Friday."
          description="Bring one project. Not the portfolio, not the archive. One."
          action={
            <ButtonLink href={site.appUrl} variant="ink" size="md">
              Start free
            </ButtonLink>
          }
        />
        <ol className="flex flex-col border-t border-hairline">
          {days.map((day, index) => (
            <li
              key={day.when}
              className="grid gap-3 border-b border-hairline py-7 sm:grid-cols-[4rem_14rem_minmax(0,1fr)] sm:items-baseline sm:gap-8 2xl:py-9"
            >
              <span className="text-base font-medium tabular-nums text-muted">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-lg font-medium text-ink 2xl:text-xl">
                {day.title}
              </span>
              <span className="max-w-2xl text-sm leading-relaxed text-muted 2xl:text-base">
                {day.body}
              </span>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
