import { Container, ButtonLink, SectionHeading } from "@/components/ui";
import { ArrowRightIcon } from "@/components/icons";
import { site } from "@/lib/site";

const objections = [
  {
    quote:
      "The client says it isn't done. I say it is. Neither of us can prove it.",
    // DECISION NEEDED: whether BuildPanda's inspection service can be called
    // "independent" or "third-party" while BuildPanda also runs builds as the
    // contractor on /construction. The same comment sits on
    // app/construction/page.tsx and app/for-owners/page.tsx. Until it is
    // decided this copy states only the mechanism the product enforces: an
    // inspection is requested, BuildPanda assigns the inspector, and the
    // contractor being inspected can read the report and cannot change it.
    answer:
      "An inspection is a job BuildPanda is asked to do, not a note the builder writes about itself. An inspector attends, records pass or fail with the findings behind it, and issues a report both sides can read. The contractor being inspected cannot change it.",
  },
  {
    quote: "My application has been sitting with the consultant for five weeks.",
    answer:
      "Applications are built from measured progress, not retyped. Each one shows what was previously certified, what is claimed now and what it totals, so there is less to argue with.",
  },
  {
    quote: "The delay wasn't ours, but I can't show that now.",
    answer:
      "A delay is recorded when it happens, with days lost, who was responsible and whether it entitles you to time. It moves the programme and the completion date with it.",
  },
  {
    quote: "I find out about a material problem when it's already in the wall.",
    answer:
      "Approve the source before the order. Record what arrived, how much, and on whose delivery note. A rejected load is on the file against that supplier.",
  },
  {
    quote: "Every site update is a photo on WhatsApp with no date on it.",
    answer:
      "The daily record carries weather, crew, hours against each activity and what was written that evening. It becomes the week's report without anyone rewriting it.",
  },
];

export function Objections() {
  return (
    <section className="py-20 sm:py-24">
      <Container className="flex flex-col gap-12">
        <SectionHeading
          eyebrow="The problem"
          title="The work was done. Proving it is the hard part."
          description="Five sentences we hear on almost every site."
        />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {objections.map((item) => (
            <div
              key={item.quote}
              className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6"
            >
              <p className="text-pretty text-lg font-semibold italic leading-snug text-ink">
                &ldquo;{item.quote}&rdquo;
              </p>
              <p className="text-sm leading-relaxed text-muted">{item.answer}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center gap-3">
          <ButtonLink href={site.appUrl} size="md">
            Start free
            <ArrowRightIcon className="h-5 w-5" />
          </ButtonLink>
          <p className="text-sm text-muted">
            Set up one job and see how it holds up.
          </p>
        </div>
      </Container>
    </section>
  );
}
