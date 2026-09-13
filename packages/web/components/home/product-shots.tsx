import Image from "next/image";
import { Container } from "@/components/ui";

// Real screens from a live road project. The figures are our own demo job —
// no customer's numbers are on this page. No fake browser chrome around them:
// a window frame with three dots says nothing the screenshot does not.
const shots = [
  {
    eyebrow: "Run the build",
    title: "A programme that moves when the site moves",
    body: "Record a delay with days lost and who was responsible. The activity shifts, everything downstream shifts, and the completion date follows.",
    proof: ["Critical path", "Delay cost", "Revised completion"],
    src: "/product/programme.jpg",
    alt: "A road programme in BuildPanda with the critical path marked, delay cost, timeline shift and a revised completion date",
    width: 1194,
    height: 466,
  },
  {
    eyebrow: "Control the money",
    title: "Certification that follows sign-off",
    body: "Contract sum, variations, certified to date, paid, retention held and still to certify. One position, not four spreadsheets that disagree.",
    proof: ["Retention", "Advance recovery", "Phase cost vs budget"],
    src: "/product/finance.jpg",
    alt: "The BuildPanda finance position: adjusted contract sum, certified gross, amount paid, retention held and phase cost against budget",
    width: 1314,
    height: 466,
  },
  {
    eyebrow: "Verify progress",
    title: "An inspection you can request",
    body: "Requested, scheduled, attended, reported. Hold points stop the next operation until they clear.",
    proof: ["Hold points", "Pass or fail", "Report both sides read"],
    src: "/product/inspections.jpg",
    alt: "The BuildPanda inspection register showing the contractor inspected, hold point, service status, inspector, outcome and visit date",
    width: 1314,
    height: 160,
  },
];

export function ProductShots() {
  return (
    <section className="border-y border-line bg-surface-faint py-20 sm:py-24 2xl:py-32">
      <Container className="flex flex-col gap-16 2xl:gap-24">
        <div className="flex flex-col gap-4">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
            Inside the software
          </span>
          <h2 className="max-w-3xl text-balance text-3xl font-bold leading-tight text-ink sm:text-4xl 2xl:text-5xl">
            What running a job on it actually looks like.
          </h2>
        </div>

        {shots.map((shot) => (
          <div key={shot.title} className="flex flex-col gap-6 2xl:gap-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
                  {shot.eyebrow}
                </span>
                <h3 className="text-balance text-2xl font-bold leading-tight text-ink sm:text-3xl 2xl:text-4xl">
                  {shot.title}
                </h3>
              </div>
              <p className="max-w-md text-pretty text-base leading-relaxed text-muted 2xl:max-w-lg 2xl:text-lg">
                {shot.body}
              </p>
            </div>

            <Image
              src={shot.src}
              alt={shot.alt}
              width={shot.width}
              height={shot.height}
              className="w-full rounded-xl border border-line bg-white shadow-[0_24px_60px_-20px_rgba(13,19,33,0.25)]"
              sizes="(max-width: 1400px) 100vw, 1600px"
            />

            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {shot.proof.map((item) => (
                <li
                  key={item}
                  className="text-sm font-medium text-muted before:mr-2 before:text-brand before:content-['—']"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Container>
    </section>
  );
}
