import Image from "next/image";
import { SectionHeading } from "@/components/ui";

// Real screens from a live road project, not illustrations: the programme with
// its critical path, the contract position, and the inspection register. The
// figures are our own demo job — no customer's numbers are on this page.
const shots = [
  {
    eyebrow: "Run the build",
    title: "A programme that moves when the site moves",
    body: "Record a delay with days lost and who was responsible. The activity shifts, everything downstream shifts, and the completion date follows.",
    src: "/product/programme.jpg",
    alt: "BuildPanda project chart: a road programme with the critical path marked, delay cost, timeline shift and a revised completion date",
    width: 1290,
    height: 470,
  },
  {
    eyebrow: "Control the money",
    title: "Certification that follows sign-off",
    body: "Contract sum, variations, certified to date, paid, retention held and still to certify — one position, not four spreadsheets.",
    src: "/product/finance.jpg",
    alt: "BuildPanda finance overview: adjusted contract sum, certified gross, amount paid, retention held and phase cost against budget",
    width: 1568,
    height: 470,
  },
  {
    eyebrow: "Verify progress",
    title: "An inspection you can request",
    body: "Requested, scheduled, attended, reported. Hold points stop the next operation until they clear.",
    src: "/product/inspections.jpg",
    alt: "BuildPanda inspection register: inspections with the contractor inspected, hold point, service status, inspector, outcome and visit date",
    width: 1470,
    height: 168,
  },
];

export function ProductShots() {
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-14 px-5 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Inside the software"
          title="What running a job on it actually looks like."
        />
        {shots.map((shot) => (
          <div key={shot.title} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
                {shot.eyebrow}
              </span>
              <h3 className="text-balance text-2xl font-bold leading-tight text-ink sm:text-3xl">
                {shot.title}
              </h3>
              <p className="max-w-2xl text-pretty text-base leading-relaxed text-muted">
                {shot.body}
              </p>
            </div>
            <figure className="overflow-hidden rounded-2xl border border-line bg-white shadow-[0_18px_50px_rgba(13,19,33,0.10)]">
              <div className="flex items-center gap-1.5 border-b border-line bg-surface-faint px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-line" />
                <span className="h-2.5 w-2.5 rounded-full bg-line" />
                <span className="h-2.5 w-2.5 rounded-full bg-line" />
              </div>
              <Image
                src={shot.src}
                alt={shot.alt}
                width={shot.width}
                height={shot.height}
                className="w-full"
                sizes="(max-width: 1400px) 100vw, 1360px"
              />
            </figure>
          </div>
        ))}
      </div>
    </section>
  );
}
