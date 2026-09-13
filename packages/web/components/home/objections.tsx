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
    <section className="py-20 sm:py-24 2xl:py-32">
      <Container className="flex flex-col gap-12 2xl:gap-16">
        <SectionHeading
          eyebrow="The problem"
          title="The work was done. Proving it is the hard part."
        />
        {/* Six columns so five items resolve as three then two, instead of
            leaving an orphan card in a three-up grid. No card fill here: the
            section either side of it is already cards. */}
        <div className="grid gap-x-10 gap-y-10 md:grid-cols-2 lg:grid-cols-6">
          {objections.map((item, index) => (
            <div
              key={item.quote}
              className={twMerge(
                "flex flex-col gap-3 border-l-2 border-brand/25 pl-5",
                index < 3 ? "lg:col-span-2" : "lg:col-span-3",
              )}
            >
              <p className="text-pretty text-lg font-semibold leading-snug text-ink 2xl:text-xl">
                &ldquo;{item.quote}&rdquo;
              </p>
              <p className="text-sm leading-relaxed text-muted 2xl:text-base">
                {item.answer}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
