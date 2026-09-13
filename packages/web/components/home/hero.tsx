import { ButtonLink } from "@/components/ui";
import { ArrowRightIcon } from "@/components/icons";
import { DeviceCluster } from "@/components/home/devices";
import { site } from "@/lib/site";

/**
 * A dark panel inset in the page, headline and offer on the left, the product
 * on the right. The reference fills the foot of the panel with a row of client
 * logos; ours carries the second product instead, because we have no customer
 * logos and will not borrow any.
 */
export function Hero() {
  return (
    <div className="p-2 sm:p-3">
      <section className="relative overflow-hidden rounded-2xl bg-ink text-white sm:rounded-3xl">
        <HeroGlow />

        <div className="site-container relative grid items-center gap-14 pb-16 pt-28 sm:pb-20 sm:pt-32 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16 lg:pb-24 lg:pt-36 2xl:gap-24 2xl:pb-28 2xl:pt-44">
          <div className="flex flex-col items-start gap-7 2xl:gap-9">
            <h1 className="display max-w-xl text-[2.5rem] text-white sm:text-5xl lg:text-6xl 2xl:max-w-2xl 2xl:text-7xl">
              Run every project from estimate to handover
            </h1>

            <p className="max-w-md text-base leading-relaxed text-white/65 2xl:max-w-lg 2xl:text-lg">
              Estimates, payments, milestones, inspections and collaboration,
              all in one place. Or leave the site to us, and we will run the
              build and report it as it happens.
            </p>

            <div className="flex flex-col items-start gap-3">
              <ButtonLink href={site.appUrl} variant="white" size="lg">
                Start free
                <ArrowRightIcon className="h-5 w-5" />
              </ButtonLink>
              <span className="text-sm text-white/50">No card required.</span>
            </div>
          </div>

          <div className="lg:pl-4">
            <DeviceCluster tone="dark" />
          </div>
        </div>

        <div id="hero-end" aria-hidden="true" />
      </section>
    </div>
  );
}

/** The reference's violet bloom, in BuildPanda's blue. */
function HeroGlow() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-[12%] -top-[38%] h-[95%] w-[62%] rounded-full bg-brand/35 blur-[150px]" />
      <div className="absolute left-[26%] -top-[20%] h-[70%] w-[34%] rounded-full bg-[#5B7BFF]/25 blur-[140px]" />
      <div className="absolute -right-[10%] bottom-[-30%] h-[70%] w-[45%] rounded-full bg-brand/20 blur-[160px]" />
    </div>
  );
}
