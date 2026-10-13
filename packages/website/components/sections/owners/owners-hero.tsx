import { LoopVideo } from "@/components/motion/loop-video";
import { ButtonLink } from "@/components/ui/button";
import { EyebrowPill } from "@/components/ui/eyebrow-pill";
import { Section } from "@/components/ui/section";
import { owners } from "@/content/owners";

const { hero } = owners;

/**
 * Owners page hero. From 1024px the animation panel is pinned to the right of
 * the section, running past the content column to 26px from the screen edge and
 * starting just clear of the navbar; below that it follows the text.
 */
export function OwnersHero() {
  return (
    <Section theme="light" className="relative overflow-hidden pt-(--nav-height)">
      <div className="site-container flex flex-col pt-10 pb-16 lg:min-h-[55rem] lg:justify-center lg:pt-0 lg:pb-[4.875rem]">
        <div className="lg:w-[42%]">
          <EyebrowPill>{hero.eyebrow}</EyebrowPill>
          <h1 className="mt-4 text-[clamp(2.5rem,1.5rem+3.6vw,4.25rem)] leading-[1.05] font-semibold tracking-[-0.03em] text-balance">
            {hero.headline}
          </h1>
          <p className="mt-5 max-w-[31rem] leading-normal text-pretty">{hero.body}</p>
          <ButtonLink variant="solid" href={hero.action.href} className="mt-7">
            {hero.action.label}
          </ButtonLink>
        </div>

        <div className="relative mt-10 aspect-[708/900] overflow-hidden bg-brand lg:absolute lg:top-[calc(var(--nav-height)+0.25rem)] lg:right-[1.625rem] lg:bottom-[4.875rem] lg:left-[47.8%] lg:mt-0 lg:aspect-auto">
          <LoopVideo src={hero.video.src} poster={hero.video.poster} className="absolute inset-0 size-full object-cover" />
          {/* The source's own grain was removed to compress it; the site's grain goes back over it. */}
          <div aria-hidden="true" className="grain" />
        </div>
      </div>
    </Section>
  );
}
