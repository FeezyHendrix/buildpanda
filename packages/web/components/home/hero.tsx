import { ButtonLink } from "@/components/ui";
import { ArrowRightIcon } from "@/components/icons";
import { DeviceCluster } from "@/components/home/devices";
import { site } from "@/lib/site";

/**
 * Full-bleed and full height, on a BuildPanda blue gradient. Headline and offer
 * on the left, the product on the right. The reference fills the foot of its
 * panel with client logos; ours carries the second product instead, because we
 * have no customer logos and will not borrow any.
 */
export function Hero() {
  return (
    <section className="relative flex min-h-svh flex-col justify-center overflow-hidden bg-[linear-gradient(157deg,#0A2FA6_0%,#004DE7_34%,#0036AE_62%,#001A56_100%)] text-white">
      <HeroGlow />

      <div className="site-container relative grid items-center gap-14 pb-20 pt-32 sm:pb-24 sm:pt-36 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.28fr)] lg:gap-16 lg:pb-28 lg:pt-40 2xl:gap-24">
        <div className="flex flex-col items-start gap-7 2xl:gap-9">
          <h1 className="display max-w-xl text-[2.5rem] text-white sm:text-5xl lg:text-6xl 2xl:max-w-2xl 2xl:text-7xl">
            Run every project from estimate to handover
          </h1>

          <p className="max-w-md text-base leading-relaxed text-white/70 2xl:max-w-lg 2xl:text-lg">
            Estimates, payments, milestones, inspections and collaboration, all
            in one place. Or leave the site to us, and we will run the build and
            report it as it happens.
          </p>

          <div className="flex flex-col items-start gap-3">
            <ButtonLink href="/talk-to-us/" variant="white" size="lg">
              Book a demo
              <ArrowRightIcon className="h-5 w-5" />
            </ButtonLink>
            <span className="text-sm text-white/55">
              Thirty minutes, on your own project.
            </span>
          </div>
        </div>

        <div className="lg:pl-4">
          <DeviceCluster tone="dark" />
        </div>
      </div>

      <div id="hero-end" aria-hidden="true" />
    </section>
  );
}

/** The reference's violet bloom, in BuildPanda's blue. */
function HeroGlow() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-[14%] -top-[28%] h-[80%] w-[58%] rounded-full bg-[#4D82FF]/45 blur-[170px]" />
      <div className="absolute left-[30%] -top-[14%] h-[62%] w-[34%] rounded-full bg-[#8FB4FF]/25 blur-[150px]" />
      <div className="absolute -right-[12%] bottom-[-26%] h-[72%] w-[46%] rounded-full bg-[#001A56]/60 blur-[170px]" />
    </div>
  );
}
