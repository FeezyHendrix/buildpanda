import { HeroFrameContinuation } from "@/components/sections/hero/hero-frame";
import { EyebrowPill } from "@/components/ui/eyebrow-pill";
import { Section } from "@/components/ui/section";
import { fragmentation } from "@/content/fragmentation";
import { PanelCaption } from "./panel-caption";
import { PlatformDiagram } from "./platform-diagram";
import { ToolChips } from "./tool-chips";

// Panel and caption share rows across the two columns, so the panels are equal height.
const COLUMN = "flex flex-col lg:row-span-2 lg:grid lg:grid-rows-subgrid lg:gap-y-0";
const PANEL = "bg-card p-4 sm:p-6 lg:min-h-[22.75rem]";

/**
 * "Construction isn't fragmented": scattered tools beside the one-platform
 * diagram. Opens with the lower half of the hero's product frame.
 */
export function Fragmentation() {
  const { broken, platform } = fragmentation;

  return (
    <Section theme="light">
      <HeroFrameContinuation />

      <div className="site-container pt-14 pb-18 sm:pt-20 lg:pb-28">
        <div>
          <EyebrowPill>
            {fragmentation.eyebrow}
          </EyebrowPill>
          <h2
            className="mt-4 text-[clamp(2rem,1.2rem+2.9vw,3.5rem)] leading-[1.05] font-medium tracking-[-0.03em] text-balance"
          >
            <span className="md:block">{fragmentation.headline[0]} </span>
            <span className="text-brand md:block">{fragmentation.headline[1]}</span>
          </h2>
          <p className="mt-5 max-w-[33rem] leading-normal text-pretty md:text-[1.0625rem]">
            {fragmentation.body}
          </p>
        </div>

        <div className="mt-12 grid gap-y-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,11fr)] lg:gap-x-14 lg:gap-y-0">
          <div className={COLUMN}>
            <div className={`${PANEL} relative h-[22.75rem] shrink-0 overflow-hidden`}>
              <ToolChips />
            </div>
            <PanelCaption {...broken} className="max-w-[22rem]" />
          </div>

          <div className={COLUMN}>
            <div className={`${PANEL} flex flex-1 flex-col justify-center lg:px-8`}>
              <PlatformDiagram />
            </div>
            <PanelCaption {...platform} className="max-w-[30rem]" />
          </div>
        </div>
      </div>
    </Section>
  );
}
