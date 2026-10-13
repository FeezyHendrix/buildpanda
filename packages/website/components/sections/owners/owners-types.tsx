import Image from "next/image";
import { EyebrowPill } from "@/components/ui/eyebrow-pill";
import { Section } from "@/components/ui/section";
import { owners } from "@/content/owners";

const { types } = owners;

/** What we manage: the kinds of project the managed service takes on, as three image cards. */
export function OwnersTypes() {
  return (
    <Section theme="light">
      <div className="site-container pt-14 pb-16 lg:pt-24 lg:pb-28">
        <EyebrowPill>{types.eyebrow}</EyebrowPill>
        <h2 className="mt-4 max-w-[13em] text-[clamp(2rem,1.2rem+2.9vw,3.5rem)] leading-[1.05] font-medium tracking-[-0.03em] text-balance">
          {types.headline}
        </h2>

        <ul className="mt-10 grid gap-6 md:grid-cols-3 lg:mt-18">
          {types.items.map((item) => (
            <li key={item.id} className="bg-card-soft">
              <Image
                src={item.src}
                alt={item.alt}
                width={types.image.width}
                height={types.image.height}
                sizes="(min-width: 768px) 30vw, calc(100vw - 2.5rem)"
                className="h-auto w-full"
              />
              <div className="p-6">
                <h3 className="text-[1.0625rem] font-semibold">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-normal text-pretty text-ink-soft">{item.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
