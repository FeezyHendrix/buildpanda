import Image from "next/image";
import { ButtonLink } from "@/components/ui/button";
import { EyebrowPill } from "@/components/ui/eyebrow-pill";
import { Section } from "@/components/ui/section";
import { contractors } from "@/content/contractors";

const { hero } = contractors;

/**
 * Contractors page hero. From 1024px the blue panel is pinned to the right of
 * the section, starting just clear of the navbar and stopping 35px from the
 * screen edge; the screenshot inside it runs off its right and bottom edges.
 * Below that the panel follows the text.
 */
export function ContractorsHero() {
  return (
    <Section theme="light" className="relative overflow-hidden pt-(--nav-height)">
      <div className="site-container flex flex-col pt-10 pb-16 lg:min-h-[55rem] lg:justify-center lg:pt-0 lg:pb-[3.75rem]">
        <div className="lg:w-[46%]">
          <EyebrowPill>{hero.eyebrow}</EyebrowPill>
          <h1 className="mt-4 text-[clamp(2.5rem,1.5rem+3.6vw,4.25rem)] leading-[1.05] font-semibold tracking-[-0.03em] text-balance">
            {hero.headline}
          </h1>
          <p className="mt-5 max-w-[31rem] leading-normal text-pretty">{hero.body}</p>
          <ButtonLink variant="solid" href={hero.action.href} className="mt-7">
            {hero.action.label}
          </ButtonLink>
        </div>

        <div className="relative mt-10 aspect-square overflow-hidden bg-brand lg:absolute lg:top-[calc(var(--nav-height)+0.25rem)] lg:right-[2.1875rem] lg:bottom-[3.75rem] lg:left-[47.15%] lg:mt-0 lg:aspect-auto">
          <div aria-hidden="true" className="grain" />
          <Image
            src={hero.image.src}
            width={hero.image.width}
            height={hero.image.height}
            alt={hero.image.alt}
            priority
            sizes="(min-width: 1024px) 50vw, 94vw"
            className="absolute top-[12%] left-[6%] h-auto w-[94%] max-w-none lg:top-[14.6%] lg:left-[4.3%] lg:w-[95.7%]"
          />
        </div>
      </div>
    </Section>
  );
}
