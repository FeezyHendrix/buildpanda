import Image from "next/image";
import { ButtonLink } from "@/components/ui";
import { DeviceCluster } from "@/components/home/devices";

/**
 * Full-bleed and full height, on a BuildPanda blue gradient. Headline and offer
 * on the left, the product on the right. The reference fills the foot of its
 * panel with client logos; ours carries the second product instead, because we
 * have no customer logos and will not borrow any.
 *
 * The NVIDIA Inception badge closing the left column is not an exception to
 * that: it is a programme BuildPanda is admitted to, so it is our own credential
 * rather than somebody else's logo standing in for a customer we do not have. It
 * sits after the offer because a credential is what you check once you are
 * interested, not the first thing that should meet the eye.
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
            Construction management software for estimates, schedules, site
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

          <InceptionBadge />
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

/**
 * NVIDIA's official member badge in the all-white colourway their identity
 * guidelines specify for dark backgrounds. `-white.svg` is the shipped artwork
 * with only its three fills set to white — the path geometry is untouched,
 * because redrawing or recreating the mark is forbidden. Keeping the green eye
 * was the other sanctioned dark-background option, but green manages only about
 * 4.5:1 on this blue against the 1:10 NVIDIA ask for, so white it is.
 *
 * Measured, white lands on rgb(3,64,196) here for 8.3:1 — comfortably past WCAG
 * AAA, still short of that 1:10. Closing the gap means darkening this end of the
 * gradient or dropping the row into the near-navy foot of the panel, which is a
 * hero-wide design call rather than something to fix by nudging this component.
 *
 * Two things not to undo:
 *  - Do not shrink it. The minimum reproduction width is 1.25in (~120px); h-16
 *    puts the frame at ~133px, and one step down drops under it.
 *  - Eager but not `priority`. It is in the first viewport so it must not
 *    lazy-load and pop in, but a preload would bid against the hero's real LCP.
 */
function InceptionBadge() {
  return (
    <div className="flex items-center gap-4 self-stretch border-t border-white/15 pt-6 sm:gap-5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
        Backed by
      </span>
      <Image
        src="/nvidia-inception-program-badge-white.svg"
        alt="BuildPanda is a member of the NVIDIA Inception Program"
        width={501}
        height={216}
        loading="eager"
        className="h-16 w-auto"
      />
    </div>
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
