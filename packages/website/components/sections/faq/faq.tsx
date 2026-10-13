import { EyebrowPill } from "@/components/ui/eyebrow-pill";
import { Section } from "@/components/ui/section";
import { faq, faqItems } from "@/content/faq";
import { FaqExplorer } from "./faq-explorer";

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

type FaqProps = {
  /**
   * Publish the questions as FAQPage structured data. On for the home page
   * only: the same questions should not be declared on more than one URL.
   */
  structuredData?: boolean;
};

/** Frequently asked questions: a search box over an accordion, optionally with the same content as structured data. */
export function Faq({ structuredData = false }: FaqProps) {
  return (
    <Section theme="light">
      {structuredData ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      ) : null}

      <div className="site-container pt-16 pb-16 lg:pt-20 lg:pb-28">
        <div className="mx-auto flex max-w-[42rem] flex-col items-center text-center">
          <EyebrowPill className="font-semibold tracking-[0.08em] uppercase">{faq.eyebrow}</EyebrowPill>
          <h2 className="mt-3 text-[clamp(2rem,1.4rem+1.9vw,2.75rem)] leading-[1.1] font-semibold tracking-[-0.03em] text-balance">
            {faq.title}
          </h2>
          <p className="mt-3 max-w-[26rem] leading-normal text-pretty">{faq.intro}</p>
        </div>

        <FaqExplorer items={faqItems} />
      </div>
    </Section>
  );
}
