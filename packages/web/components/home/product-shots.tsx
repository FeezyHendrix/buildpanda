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
    id: "construction-scheduling",
    label: "Scheduling",
    number: "01",
    eyebrow: "Construction scheduling & delays",
    title: "A programme that moves when the site moves",
    body: "Record a delay with the days lost and who was responsible. The activity shifts, everything downstream shifts, and the completion date follows.",
    proof: ["Critical chain", "Delay cost", "Revised completion"],
    src: "/product/programme.jpg",
    alt: "The project chart on a road job: critical chain, open delays and delay cost above a Gantt whose bars include the recorded rain and client delays",
  },
  {
    id: "drawing-management",
    label: "Drawings",
    number: "02",
    eyebrow: "Drawing management & markups",
    title: "Mark up the sheet, measure off it",
    body: "Pan, measure, pen, cloud and comment on the drawing itself. The sheet scale is read off the title block, so a measurement comes back in millimetres rather than pixels.",
    proof: ["Scale read from the sheet", "Revisions compared", "Markups pinned to a revision"],
    src: "/product/plans.jpg",
    alt: "A roof plan open in the review workspace with the markup toolbar, the scale detected as 1:120 from the sheet, and a review notes panel beside it",
  },
  {
    id: "construction-rfis",
    label: "RFIs",
    number: "03",
    eyebrow: "Construction RFIs & collaboration",
    title: "The question and the answer live on the record",
    body: "An RFI carries who asked, what was asked, the drawing it is against, when it is due and who has answered. Nothing important stays in somebody's inbox.",
    proof: ["Overdue flagged", "Responses counted", "Raised against a drawing"],
    src: "/product/rfis.jpg",
    alt: "The RFI register: each request with its number, status, due date, the drawing it refers to, and how many responses it has",
  },
  {
    id: "site-diary",
    label: "Site diary",
    number: "04",
    eyebrow: "Site diary & daily reports",
    title: "The day gets written down while it is still the day",
    body: "Weather, crew against crew expected, hours, and which activities those hours went on. It works on a phone on site and becomes the week's report without anyone retyping it.",
    proof: ["Crew and hours", "Weather", "Hours against activities"],
    src: "/product/daily-log.jpg",
    alt: "The daily log: days logged, missed days, total hours and average crew above a table of days with weather, crew, hours and activities",
  },
  {
    id: "site-inspections",
    label: "Inspections",
    number: "05",
    eyebrow: "Site inspections & hold points",
    title: "An inspection you can request",
    body: "One side requests it, BuildPanda assigns the inspector, and the report cannot be changed by the contractor it covers. A hold point stops the next operation until it clears.",
    proof: ["Hold points", "Pass or fail", "Named inspector"],
    src: "/product/inspections.jpg",
    alt: "The inspection register: each inspection with the contractor inspected, where it holds, its hold point, service status, inspector and outcome",
  },
  {
    id: "construction-finance",
    label: "Finances",
    number: "06",
    eyebrow: "Payment certificates & cost control",
    title: "One contract position, not four spreadsheets",
    body: "Original sum, variations, certified to date, still to certify, paid, unpaid certified and retention held, each read from the certificates behind it.",
    proof: ["Variations", "Retention held", "Unpaid certified"],
    src: "/product/finance.jpg",
    alt: "The finance overview: original contract sum through variations to certified, still to certify, amount paid, unpaid certified and retention held",
  },
];

export function ProductShots() {
  return (
    <section id="product" aria-label="Explore the construction management software" className="bg-surface py-16 sm:py-24 2xl:py-28">
      <Container className="flex flex-col gap-12 2xl:gap-16">
        <SectionHeading
          eyebrow="Inside the software"
          title="Construction management tools, from planning to handover."
          description="Plan the work, capture what happens on site and follow the cost. Explore the tools your team uses to keep a construction project moving."
        />

        <nav aria-label="Software features" className="flex flex-wrap gap-2">
          {shots.map((shot) => (
            <a key={shot.id} href={`#${shot.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand">
              {shot.label}
            </a>
          ))}
        </nav>

        <div className="flex flex-col border-t border-hairline">
          {shots.map((shot, index) => (
            <div
              id={shot.id}
              key={shot.title}
              className="grid items-center gap-10 border-b border-hairline py-14 lg:grid-cols-2 lg:gap-12 2xl:gap-16 2xl:py-20"
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
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <Image
                src={shot.src}
                alt={shot.alt}
                width={2468}
                height={1542}
                sizes="(max-width: 1023px) calc(100vw - 48px), (max-width: 1535px) 520px, (max-width: 1799px) 640px, (max-width: 2599px) 760px, 940px"
                className={`w-full rounded-lg border border-line bg-white shadow-[0_30px_70px_-35px_rgba(13,19,33,0.45)] ${index % 2 === 1 ? "lg:order-1" : ""}`}
              />
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
