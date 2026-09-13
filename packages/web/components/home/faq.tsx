import { Container, SectionHeading } from "@/components/ui";
import { faqItems } from "@/lib/faq";

export function Faq() {
  return (
    <section className="py-20 sm:py-24">
      <Container className="flex flex-col gap-12">
        <SectionHeading
          eyebrow="FAQ"
          title="Questions people actually ask"
        />
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
          {faqItems.map((item, index) => (
            <details
              key={item.q}
              open={index === 0}
              className="group rounded-2xl border border-line bg-white px-5 py-4 open:shadow-[0_8px_30px_rgba(13,19,33,0.05)]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-ink marker:hidden">
                {item.q}
                <span
                  aria-hidden="true"
                  className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-line text-muted transition-transform group-open:rotate-45"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
