import { Container, SectionHeading } from "@/components/ui";
import { twMerge } from "tailwind-merge";

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
  },
  {
    quote: "My application has been sitting with the consultant for five weeks.",
    answer:
      "Applications are built from measured progress, showing what was certified before and what is claimed now.",
  },
  {
    quote: "The delay wasn't ours, but I can't show that now.",
    answer:
      "A delay is recorded the day it happens, with days lost and who was responsible. It moves the completion date with it.",
  },
  {
    quote: "I find out about a material problem when it's already in the wall.",
    answer:
      "Approve the source before the order. A rejected load stays on the file against that supplier.",
  },
  {
    quote: "Every site update is a photo on WhatsApp with no date on it.",
    answer:
      "The daily record carries weather, crew and hours, and becomes the week's report without rewriting.",
  },
];

export function Objections() {
  return (
    <section className="bg-surface py-24 sm:py-32 2xl:py-40">
      <Container className="flex flex-col gap-14 2xl:gap-20">
        <SectionHeading
          eyebrow="The problem"
          title="The work was done. Proving it is the hard part."
        />
        {/* A divided grid rather than five floating cards: the hairlines do the
            separating, so nothing needs a border, a radius and a shadow each. */}
        <div className="grid border-t border-hairline sm:grid-cols-2 lg:grid-cols-6">
          {objections.map((item, index) => (
            <div
              key={item.quote}
              className={twMerge(
                "flex flex-col gap-4 border-b border-hairline py-9 pr-8 sm:pl-8 sm:[&:nth-child(odd)]:pl-0 lg:pl-8 lg:[&:nth-child(odd)]:pl-8 lg:[&:first-child]:pl-0 lg:[&:nth-child(4)]:pl-0",
                "sm:border-l-0 lg:border-l lg:first:border-l-0 lg:[&:nth-child(4)]:border-l-0",
                index < 3 ? "lg:col-span-2" : "lg:col-span-3",
              )}
            >
              <p className="max-w-sm text-pretty text-xl leading-snug text-ink 2xl:text-2xl">
                &ldquo;{item.quote}&rdquo;
              </p>
              <p className="max-w-md text-sm leading-relaxed text-muted 2xl:text-base">
                &rarr; {item.answer}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
