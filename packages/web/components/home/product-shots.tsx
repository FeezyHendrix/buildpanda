import Image from "next/image";
import { Container, SectionHeading } from "@/components/ui";

/**
 * Alternating rows on hairlines, matching the rest of the page: no card, no
 * radius-and-shadow on every block, no invented browser chrome. All three
 * screens are the same project rendered at the same laptop viewport, so they
 * are one size and one shape and the UI inside them is large enough to read.
 */
const shots = [
  {
    number: "01",
    eyebrow: "Run the build",
    title: "A programme that moves when the site moves",
    body: "Record a delay with the days lost and who was responsible. The activity shifts, everything downstream shifts, and the completion date follows.",
    proof: ["Critical chain", "Delay cost", "Revised completion"],
    src: "/product/programme.jpg",
    alt: "The project chart on a road job: critical chain, open delays and delay cost above a Gantt whose bars include the recorded rain and client delays",
  },
  {
    number: "02",
    eyebrow: "Control the money",
    title: "One contract position, not four spreadsheets",
    body: "Original sum, variations, certified to date, still to certify, paid, unpaid certified and retention held, each read from the certificates behind it.",
    proof: ["Variations", "Retention held", "Unpaid certified"],
    src: "/product/finance.jpg",
    alt: "The finance overview: original contract sum through variations to certified, still to certify, amount paid, unpaid certified and retention held",
  },
  {
    number: "03",
    eyebrow: "Verify progress",
    title: "An inspection you can request",
    body: "Requested, scheduled, attended, reported, with the outcome on the row. A hold point stops the next operation until it clears.",
    proof: ["Hold points", "Pass or fail", "Named inspector"],
    src: "/product/inspections.jpg",
    alt: "The inspection register: each inspection with the contractor inspected, where it holds, its hold point, service status, inspector and outcome",
  },
];

export function ProductShots() {
  return (
    <section className="bg-surface py-24 sm:py-32 2xl:py-40">
      <Container className="flex flex-col gap-16 2xl:gap-24">
        <SectionHeading
          eyebrow="Inside the software"
          title="What running a job on it actually looks like."
        />

        <div className="flex flex-col border-t border-hairline">
          {shots.map((shot, index) => (
            <div
              key={shot.title}
              className="grid items-center gap-10 border-b border-hairline py-14 lg:grid-cols-2 lg:gap-16 2xl:gap-24 2xl:py-20"
            >
              <div
                className={`flex flex-col gap-5 ${index % 2 === 1 ? "lg:order-2" : ""}`}
              >
                <div className="flex items-baseline gap-4">
                  <span className="text-sm font-medium tabular-nums text-muted">
                    {shot.number}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
                    {shot.eyebrow}
                  </span>
                </div>
                <h3 className="display max-w-md text-3xl text-ink sm:text-4xl 2xl:text-5xl">
                  {shot.title}
                </h3>
                <p className="max-w-md text-base leading-relaxed text-muted 2xl:text-lg">
                  {shot.body}
                </p>
                <ul className="flex flex-wrap gap-x-6 gap-y-2 pt-2">
                  {shot.proof.map((item) => (
                    <li key={item} className="text-sm text-muted">
                      &rarr; {item}
                    </li>
                  ))}
                </ul>
              </div>

              <Image
                src={shot.src}
                alt={shot.alt}
                width={2468}
                height={1542}
                sizes="(max-width: 1024px) 100vw, 800px"
                className={`w-full rounded-lg border border-line bg-white shadow-[0_30px_70px_-35px_rgba(13,19,33,0.45)] ${index % 2 === 1 ? "lg:order-1" : ""}`}
              />
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
