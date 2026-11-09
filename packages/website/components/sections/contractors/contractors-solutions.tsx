import Image from "next/image";
import { ButtonLink } from "@/components/ui/button";
import { EyebrowPill } from "@/components/ui/eyebrow-pill";
import { Section } from "@/components/ui/section";
import { contractors } from "@/content/contractors";
import { SolutionsTabs } from "./solutions-tabs";

const { solutions } = contractors;

/**
 * Our Solutions. From 1024px a tab list of product areas beside the selected
 * area's screenshot; below that each area is its own card, screenshot first.
 * Only one of the two layouts is ever displayed.
 */
export function ContractorsSolutions() {
  return (
    <Section theme="light">
      <div className="site-container pt-14 pb-16 lg:py-20">
        <EyebrowPill>{solutions.eyebrow}</EyebrowPill>
        <h2 className="mt-2 text-[clamp(2rem,1.2rem+2.9vw,3.5rem)] leading-[1.05] font-medium tracking-[-0.03em] text-balance">
          {solutions.headline}
        </h2>
        <ButtonLink variant="solid" href={solutions.action.href} className="mt-6">
          {solutions.action.label}
        </ButtonLink>

        <SolutionsTabs className="mt-16 hidden lg:grid" />

        <ul className="mt-10 grid gap-8 md:grid-cols-2 lg:hidden">
          {solutions.items.map((item) => (
            <li key={item.id}>
              <div className="relative aspect-[336/300] overflow-hidden bg-brand">
                <div aria-hidden="true" className="grain" />
                <Image
                  src={item.src}
                  width={solutions.image.width}
                  height={solutions.image.height}
                  alt={item.alt}
                  sizes="(min-width: 768px) 45vw, 90vw"
                  className="absolute top-[12%] left-[6%] h-auto w-[94%] max-w-none"
                />
              </div>
              <div className="border border-t-0 border-line p-5">
                <h3 className="text-[1.375rem] leading-tight font-semibold tracking-[-0.02em]">{item.title}</h3>
                <p className="mt-3 leading-normal text-pretty text-ink-soft">{item.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
