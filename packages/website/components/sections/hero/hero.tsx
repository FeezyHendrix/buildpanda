import Image from "next/image";
import { ButtonLink } from "@/components/ui/button";
import { EyebrowPill } from "@/components/ui/eyebrow-pill";
import { Section } from "@/components/ui/section";
import { hero } from "@/content/hero";
import { HeroFrameTop } from "./hero-frame";
import { LifecycleList } from "./lifecycle-list";

/**
 * Home page hero. The product frame's lower half is rendered by
 * `HeroFrameContinuation` at the top of the next section.
 */
export function Hero() {
  const { backedBy } = hero;

  return (
    <Section theme="brand" className="relative overflow-hidden pt-[calc(var(--nav-height)+2.5rem)] lg:pt-[calc(var(--nav-height)+4.875rem)]">
      <div aria-hidden="true" className="hero-backdrop" />

      <div className="site-container relative">
        <div className="max-w-2xl">
          <EyebrowPill>
            {hero.eyebrow}
          </EyebrowPill>

          <h1
            className="mt-4 text-[clamp(2.5rem,1.5rem+3.4vw,4rem)] leading-[1.05] font-semibold tracking-[-0.03em] text-balance"
          >
            {hero.headline.map((line) => (
              <span key={line} className="sm:block">
                {line}{" "}
              </span>
            ))}
          </h1>

          <p className="mt-5 max-w-[31rem] text-base leading-normal text-pretty md:text-[1.0625rem]">
            {hero.pitch}
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink variant="solid" href={hero.primaryAction.href}>
              {hero.primaryAction.label}
            </ButtonLink>
            <ButtonLink variant="outline" href={hero.secondaryAction.href}>
              {hero.secondaryAction.label}
            </ButtonLink>
          </div>

          <div className="mt-7">
            <p className="text-[0.8125rem] font-medium">{backedBy.label}</p>
            <Image
              src={backedBy.logo.src}
              alt={backedBy.logo.alt}
              width={backedBy.logo.width}
              height={backedBy.logo.height}
              className="mt-2.5 h-14 w-auto lg:h-16"
            />
          </div>
        </div>

        <LifecycleList className="absolute -top-7 right-8 hidden lg:block" />

        <div className="mt-10">
          <HeroFrameTop />
        </div>
      </div>

      {/* Small screens: the image and the blue behind it dissolve into the next section. */}
      <div aria-hidden="true" className="hero-fade sm:hidden" />
    </Section>
  );
}
