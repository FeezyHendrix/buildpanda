import { Container, ButtonLink } from "@/components/ui";
import { ArrowRightIcon } from "@/components/icons";
import { site } from "@/lib/site";

export function FinalCta() {
  return (
    <section className="bg-ink py-16 sm:py-20">
      <Container className="flex flex-col items-center gap-6 text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
          Prove the work. Defend the payment.
        </span>
        <h2 className="text-balance text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
          Put one job on it.
        </h2>
        <p className="max-w-2xl text-pretty text-base leading-relaxed text-white/70 sm:text-lg">
          One project, one week, and you will know whether the record holds up.
          Or tell us about the job and we will build it.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/talk-to-us/" variant="white" size="lg">
            Book a demo
            <ArrowRightIcon className="h-5 w-5" />
          </ButtonLink>
          <ButtonLink
            href="/talk-to-us/"
            size="lg"
            className="border border-white/25 bg-transparent text-white hover:bg-white/10"
          >
            Talk to us about building
          </ButtonLink>
        </div>
        <p className="text-sm text-white/60">
          Thirty minutes, on your own project, with someone who knows the trade.
        </p>
      </Container>
    </section>
  );
}
