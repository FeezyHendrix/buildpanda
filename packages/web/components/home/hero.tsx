import { Container, ButtonLink, Badge } from "@/components/ui";
import { ArrowRightIcon } from "@/components/icons";
import { site } from "@/lib/site";
import { HeroCertificate } from "@/components/home/hero-certificate";

// H1 and subheadline both set by the product owner. One CTA only: the build
// service is sold further down the page, in the two-doors section, rather
// than competing with Start free in the first screen.
// Two alternates to A/B against the H1:
//   "Run the build, or have us run it. Either way, prove it."
//   "Prove the work. Defend the payment."  (currently on the sticky bar and
//                                           the final CTA)
export function Hero() {
  return (
    <section className="relative overflow-hidden bg-white">
      <Container className="grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:py-24 2xl:gap-24 2xl:py-32">
        <div className="flex flex-col items-start gap-6">
          <Badge>Verified construction delivery</Badge>
          <h1 className="text-balance text-4xl font-extrabold leading-[1.06] tracking-tight text-ink sm:text-5xl lg:text-[3.5rem] 2xl:text-[4.5rem]">
            Run every project from estimate to handover, on one system.
          </h1>
          <p className="max-w-xl text-pretty text-lg leading-relaxed text-muted 2xl:max-w-2xl 2xl:text-xl">
            Run your entire construction project from proposal to completion
            with estimates, payments, milestones, inspections, and
            collaboration all in one place.
          </p>
          <ButtonLink href={site.appUrl} size="lg">
            Start free
            <ArrowRightIcon className="h-5 w-5" />
          </ButtonLink>
        </div>
        <HeroCertificate />
      </Container>
      <div id="hero-end" aria-hidden="true" />
    </section>
  );
}
