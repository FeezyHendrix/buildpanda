import { ButtonLink } from "@/components/ui";
import { DeviceCluster } from "@/components/home/devices";

/**
 * Full-bleed and full height, on a BuildPanda blue gradient. Headline and offer
 * on the left, the product on the right. The reference fills the foot of its
 * panel with client logos; ours carries the second product instead, because we
 * have no customer logos and will not borrow any.
 */
export function Hero() {
  return (
    <section className="relative flex min-h-svh flex-col overflow-hidden bg-[linear-gradient(157deg,#0A2FA6_0%,#004DE7_34%,#0036AE_62%,#001A56_100%)] text-white">
      <HeroGlow />

      <div className="site-container relative grid flex-1 items-center gap-14 pb-20 pt-32 sm:pb-24 sm:pt-36 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.28fr)] lg:gap-16 lg:pb-28 lg:pt-40 2xl:gap-24">
        <div className="flex flex-col items-start gap-7 2xl:gap-9">
          <h1 className="display max-w-xl text-[2.5rem] text-white sm:text-5xl lg:text-6xl 2xl:max-w-2xl 2xl:text-7xl">
            Run every project from estimate to handover
          </h1>

          <p className="max-w-md text-base leading-relaxed text-white/70 2xl:max-w-lg 2xl:text-lg">
            AI-powered construction management software for estimates, schedules, site
            inspections and payment records. Keep contractors, project managers
            and owners working from one project record.
          </p>

          <div className="flex w-full flex-col gap-3 min-[400px]:w-auto min-[400px]:flex-row">
            <ButtonLink href="/talk-to-us/" variant="white" size="lg">
              Book a demo
            </ButtonLink>
            <ButtonLink
              href="#product"
              variant="ghost"
              size="lg"
              className="border border-white/30 text-white hover:bg-white/10 hover:text-white"
            >
              Explore the software
            </ButtonLink>
          </div>
        </div>

        <div className="lg:pl-4">
          <DeviceCluster tone="dark" />
        </div>
      </div>

      <div className="relative border-t border-white/15 bg-[#001A56]/20">
        <div className="site-container flex flex-col gap-3 py-5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-8">
          <p className="text-white/80">Need a team on the ground for your build?</p>
          <a
            href="/construction/"
            className="inline-flex min-h-11 items-center self-start font-semibold text-white hover:underline sm:shrink-0"
          >
            Meet your construction team
          </a>
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
