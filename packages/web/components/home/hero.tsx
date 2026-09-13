import { ButtonLink } from "@/components/ui";
import { DeviceCluster } from "@/components/home/devices";
import { site } from "@/lib/site";

/**
 * The headline sits low on a tall panel of soft gradient, the way the reference
 * does it, rather than centred over a screenshot. The supporting line is split
 * into two short columns with an arrow between them; the slot the reference
 * fills with a review score carries the offer instead, because we have no
 * reviews to quote and will not invent any.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden bg-surface-muted">
      <HeroArtwork />

      <div className="site-container relative flex flex-col justify-end pb-10 pt-16 sm:pt-20 2xl:pb-14 2xl:pt-24">
        <h1 className="display max-w-4xl text-[2.75rem] text-ink sm:text-6xl lg:text-7xl 2xl:max-w-6xl 2xl:text-[5.5rem]">
          Run every project from estimate to handover
        </h1>

        <div className="mt-10 flex flex-col gap-8 border-t border-hairline pt-8 lg:mt-14 lg:flex-row lg:items-start lg:gap-16">
          <p className="max-w-xs text-base leading-relaxed text-muted 2xl:text-lg">
            Estimates, payments, milestones, inspections and collaboration, all
            in one place.
          </p>

          <span aria-hidden="true" className="hidden text-2xl text-ink lg:block">
            &rarr;
          </span>

          <p className="max-w-xs text-base leading-relaxed text-muted 2xl:text-lg">
            Or leave the site to us, and we will run the build and report it as
            it happens.
          </p>

          <div className="flex flex-col items-start gap-3 lg:ml-auto lg:items-end">
            <ButtonLink href={site.appUrl} variant="ink" size="lg">
              Start free
            </ButtonLink>
            <span className="text-sm text-muted">No card required.</span>
          </div>
        </div>
      </div>

      <div className="site-container relative mt-16 pb-16 sm:mt-20 sm:pb-24 2xl:mt-24 2xl:pb-32">
        <DeviceCluster />
      </div>

      <div id="hero-end" aria-hidden="true" />
    </section>
  );
}

/**
 * Overlapping translucent panels on a diagonal, in BuildPanda's blue rather
 * than the reference's peach-to-lilac. Pure CSS: a bitmap would band on a wide
 * screen and cost 300KB to do it.
 */
function HeroArtwork() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(105deg,#fdf3e7_0%,#eef1fb_26%,#dcdffb_46%,#d3e4fb_66%,#cfe6fb_82%,#eaf2fb_100%)]" />
      <div className="absolute -left-[10%] -top-[35%] h-[170%] w-[26%] -rotate-[24deg] bg-white/35 blur-[1px]" />
      <div className="absolute left-[18%] -top-[45%] h-[180%] w-[16%] -rotate-[24deg] bg-white/25" />
      <div className="absolute left-[40%] -top-[30%] h-[170%] w-[22%] -rotate-[24deg] bg-brand/[0.07]" />
      <div className="absolute left-[64%] -top-[50%] h-[190%] w-[18%] -rotate-[24deg] bg-white/40" />
      <div className="absolute left-[82%] -top-[25%] h-[160%] w-[24%] -rotate-[24deg] bg-brand/[0.05]" />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent to-surface-muted" />
    </div>
  );
}
