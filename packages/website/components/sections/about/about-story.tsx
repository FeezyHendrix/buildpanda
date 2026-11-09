import Image from "next/image";
import { EyebrowPill } from "@/components/ui/eyebrow-pill";
import { Section } from "@/components/ui/section";
import { about } from "@/content/about";

const { story } = about;

/** Our story: why BuildPanda exists. Image beside the text; image first on small screens. */
export function AboutStory() {
  return (
    <Section theme="light">
      <div className="site-container grid items-center gap-10 py-14 lg:grid-cols-[minmax(0,518fr)_minmax(0,615fr)] lg:gap-16 lg:py-24">
        <Image
          src={story.image.src}
          alt={story.image.alt}
          width={story.image.width}
          height={story.image.height}
          sizes="(min-width: 1024px) 40vw, calc(100vw - 2.5rem)"
          className="h-auto w-full"
        />

        <div>
          <EyebrowPill>{story.eyebrow}</EyebrowPill>
          <h2 className="mt-4 max-w-[14ch] text-[clamp(2rem,1.2rem+2.9vw,3.5rem)] leading-[1.05] font-medium tracking-[-0.03em] text-balance">
            {story.headline}
          </h2>
          <div className="mt-8 max-w-[38.5rem] space-y-6 leading-normal text-pretty">
            {story.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}
