import Image from "next/image";
import { EyebrowPill } from "@/components/ui/eyebrow-pill";
import { Section } from "@/components/ui/section";
import { about } from "@/content/about";
import { BuildingLights } from "./building-lights";

const { hero } = about;

// One drawing, used in both bottom corners; the right-hand one is mirrored.
const BUILDINGS = "pointer-events-none absolute -bottom-6 w-[clamp(10.5rem,15vw,13.75rem)]";

type BuildingsProps = { className: string; phase: number };

function Buildings({ className, phase }: BuildingsProps) {
  return (
    <div aria-hidden="true" className={`${BUILDINGS} ${className}`}>
      <Image
        src={hero.illustration.src}
        alt=""
        width={hero.illustration.width}
        height={hero.illustration.height}
        className="block h-auto w-full"
      />
      <BuildingLights phase={phase} className="absolute inset-0 size-full" />
    </div>
  );
}

/** About page hero: the company's purpose, over a skyline at the foot of the section. */
export function AboutHero() {
  return (
    <Section theme="brand" className="relative overflow-hidden">
      <div aria-hidden="true" className="grain" />
      <Buildings className="-left-4" phase={0} />
      <Buildings className="-right-4 -scale-x-100" phase={3.5} />

      <div className="site-container relative flex flex-col items-center pt-[calc(var(--nav-height)+3rem)] pb-57 text-center md:pt-[calc(var(--nav-height)+2.5rem)] md:pb-44">
        <EyebrowPill>{hero.eyebrow}</EyebrowPill>
        <h1 className="mt-4 max-w-[56rem] text-[clamp(2.5rem,1.5rem+3.6vw,4.25rem)] leading-[1.05] font-semibold tracking-[-0.03em] text-balance">
          {hero.headline}
        </h1>
        <p className="mt-5 max-w-[31.5rem] text-[0.9375rem] leading-normal text-pretty">{hero.body}</p>
      </div>
    </Section>
  );
}
