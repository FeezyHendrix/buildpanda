import { Container, ButtonLink, SectionHeading } from "@/components/ui";
import {
  ArrowRightIcon,
  CompassIcon,
  MilestoneIcon,
  ClipboardIcon,
  WalletIcon,
  UsersIcon,
} from "@/components/icons";
import { site } from "@/lib/site";

// The deck carries a "Result:" line under each block. Every one of them is an
// unmeasured placeholder, so none of them ship.
const jobs = [
  {
    icon: <CompassIcon className="h-6 w-6" />,
    label: "Win the work",
    title: "From enquiry to signed",
    body: "Keep every enquiry in one pipeline. Price the estimate against the work library your bill is written from. Send a proposal the client accepts online, and it becomes the project.",
  },
  {
    icon: <MilestoneIcon className="h-6 w-6" />,
    label: "Run the build",
    title: "A programme that moves when the site moves",
    body: "Stages, activities and look-aheads. Record a delay with days lost and who was responsible, and the programme shifts: the activity, everything that follows it, and the completion date.",
  },
  {
    icon: <ClipboardIcon className="h-6 w-6" />,
    label: "Verify progress",
    title: "Evidence, not assertion",
    body: "Daily records with crew, hours and weather. Inspections with pass, fail and findings. Hold points that stop the next operation until they clear.",
  },
  {
    icon: <WalletIcon className="h-6 w-6" />,
    label: "Control the money",
    title: "Certificates, variations and time",
    body: "Interim applications with retention and advance recovery. Variations priced and decided on the record. Time claims that move the completion date, so damages are measured against the date you were actually given.",
  },
  {
    icon: <UsersIcon className="h-6 w-6" />,
    label: "Keep the client informed",
    title: "A view without a phone call",
    body: "The client sees progress, dates and what is waiting on them. They do not see your costs, your margin or your suppliers' prices.",
  },
];

export function SoftwareJobs() {
  return (
    <section className="py-20 sm:py-24">
      <Container className="flex flex-col gap-12">
        <SectionHeading
          eyebrow="If you are running the build yourself, this is what you get"
          title="Five jobs, start to finish."
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <div
              key={job.title}
              className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6 transition-shadow hover:shadow-[0_8px_30px_rgba(13,19,33,0.06)]"
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand">
                {job.icon}
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
                {job.label}
              </span>
              <h3 className="text-lg font-semibold leading-snug text-ink">
                {job.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted">{job.body}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-center">
          <ButtonLink href={site.appUrl} size="md">
            Start free
            <ArrowRightIcon className="h-5 w-5" />
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
