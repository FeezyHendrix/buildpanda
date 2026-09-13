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
    <section className="py-20 sm:py-24">
      <Container className="flex flex-col gap-12">
        <SectionHeading
          eyebrow="The problem"
          title="The work was done. Proving it is the hard part."
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
      </Container>
    </section>
  );
}
