import { Container, ButtonLink, Badge } from "@/components/ui";
import { ArrowRightIcon } from "@/components/icons";
import { site } from "@/lib/site";
import { HeroCertificate } from "@/components/home/hero-certificate";

// H1 set by the product owner. The second product has to be visible in the
// first screen, so the subheadline carries it and each CTA says which product
// it opens. Two alternates to A/B against this line:
//   "Run the build, or have us run it. Either way, prove it."
//   "Prove the work. Defend the payment."  (currently on the sticky bar and
//                                           the final CTA)
export function Hero() {
  return (
    <section className="relative overflow-hidden bg-white">
      <Container className="grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:py-24">
        <div className="flex flex-col items-start gap-6">
          <Badge>Verified construction delivery</Badge>
          <h1 className="text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-[3.5rem]">
            Run every project from estimate to handover, on one system.
          </h1>
          <p className="max-w-xl text-pretty text-lg leading-relaxed text-muted">
            BuildPanda is the software contractors, developers and project
            managers run their builds on. If you would rather not run the site
            yourself, we will build it for you.
          </p>
          <p className="max-w-xl text-pretty text-base leading-relaxed text-muted">
            Most disputes on site are not about the work. They are about what can
            be shown afterwards. Photos with no date. A delay nobody recorded. A
            certificate nobody can tie to a measurement. Whichever way you work
            with us, the job is run so that the file exists before anyone asks
            for it.
          </p>
          <div className="flex w-full flex-col gap-5 sm:flex-row sm:gap-6">
            <div className="flex flex-col items-start gap-2">
              <ButtonLink href={site.appUrl} size="lg">
                Start free
                <ArrowRightIcon className="h-5 w-5" />
              </ButtonLink>
              <p className="text-sm text-muted">
                The software. Set it up yourself, no card.
              </p>
            </div>
            <div className="flex flex-col items-start gap-2">
              <ButtonLink href="/talk-to-us/" variant="outline" size="lg">
                Talk to us about building
              </ButtonLink>
              <p className="text-sm text-muted">
                The build service. We run the site.
              </p>
            </div>
          </div>
        </div>
        <HeroCertificate />
      </Container>
      <div id="hero-end" aria-hidden="true" />
    </section>
  );
}
