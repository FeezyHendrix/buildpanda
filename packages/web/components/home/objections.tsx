import { Container, SectionHeading } from "@/components/ui";

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
      "An inspector attends and files a pass or a fail with the findings. The contractor being inspected cannot change it.",
  },{
    quote: "The delay wasn't ours, but I can't show that now.",
    answer:
      "A delay is recorded the day it happens, with days lost and who was responsible. It moves the completion date with it.",
  },{
    quote: "Every site update is a photo on WhatsApp with no date on it.",
    answer:
      "The daily record carries weather, crew and hours, and becomes the week's report without rewriting.",
  },
];

export function Objections() {
  return (
    <section className="bg-surface py-16 sm:py-24 2xl:py-28">
      <Container className="flex flex-col gap-10 2xl:gap-14">
        <SectionHeading
          eyebrow="The problem"
          title="The work was done. Proving it is the hard part."
        />
        {/* A divided grid rather than floating cards: the hairlines do the
            separating, so nothing needs a border, a radius and a shadow each. */}
        <div className="grid border-t border-hairline lg:grid-cols-3">
          {objections.map((item) => (
            <div
              key={item.quote}
              className="flex flex-col gap-4 border-b border-hairline py-9 pr-8 lg:border-l lg:pl-8 lg:first:border-l-0 lg:first:pl-0"
            >
              <p className="max-w-sm text-pretty text-xl leading-snug text-ink 2xl:text-2xl">
                &ldquo;{item.quote}&rdquo;
              </p>
              <p className="max-w-md text-sm leading-relaxed text-muted 2xl:text-base">
                {item.answer}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
