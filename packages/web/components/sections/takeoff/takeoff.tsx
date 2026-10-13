import { ButtonLink } from "@/components/ui/button";
import { EyebrowPill } from "@/components/ui/eyebrow-pill";
import { Section } from "@/components/ui/section";
import { takeoff } from "@/content/takeoff";
import { AiMarker } from "./ai-marker";
import { DrawingCard } from "./drawing-card";
import { TakeoffSheet } from "./takeoff-sheet";
import { TakeoffSteps } from "./takeoff-steps";

/** Panda AI: a drawing goes in, an itemised takeoff sheet comes out. */
export function Takeoff() {
  return (
    <Section theme="dark" id="how-it-works" className="scroll-mt-(--nav-height) overflow-hidden">
      <div className="site-container py-16 lg:py-24">
        <EyebrowPill>{takeoff.eyebrow}</EyebrowPill>
        <h2 className="mt-4 text-[clamp(2rem,1.2rem+2.9vw,3.5rem)] leading-[1.05] font-medium tracking-[-0.03em] text-balance">
          <span className="md:block">{takeoff.headline[0]} </span>
          <span className="md:block">{takeoff.headline[1]}</span>
        </h2>
        <p className="mt-5 max-w-[31rem] leading-normal text-pretty md:text-[1.0625rem]">{takeoff.body}</p>
        <ButtonLink variant="solid" href={takeoff.action.href} className="mt-7">
          {takeoff.action.label}
        </ButtonLink>

        <div className="mt-16 grid items-center lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-x-10">
          <DrawingCard />
          <AiMarker />
          <TakeoffSheet className="w-full" />
        </div>

        <div className="mt-14 lg:mt-18">
          <TakeoffSteps />
        </div>
      </div>
    </Section>
  );
}
