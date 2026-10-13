import { CircleMinus, CirclePlus } from "lucide-react";
import type { FaqItem as FaqItemData } from "@/content/faq";

type FaqItemProps = { item: FaqItemData; open: boolean; onToggle: () => void };

/**
 * One question. The answer's height animates by growing a grid row from 0 to
 * its content (`.faq-answer`); while closed it is inert, so it cannot be
 * focused or read out.
 */
export function FaqItem({ item, open, onToggle }: FaqItemProps) {
  const buttonId = `faq-${item.id}`;
  const panelId = `${buttonId}-answer`;
  const Icon = open ? CircleMinus : CirclePlus;

  return (
    <li className="border-line not-first:border-t">
      <h3>
        <button
          type="button"
          id={buttonId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex min-h-11 w-full items-center justify-between gap-4 px-4 py-3.5 text-left text-[0.9375rem] font-semibold -outline-offset-2"
        >
          {item.question}
          <Icon aria-hidden="true" strokeWidth={1.75} className="size-[1.125rem] shrink-0" />
        </button>
      </h3>
      <div id={panelId} role="region" aria-labelledby={buttonId} inert={!open} data-open={open} className="faq-answer">
        <div className="overflow-hidden">
          <p className="pr-12 pb-4 pl-4 text-[0.9375rem] leading-normal text-pretty">{item.answer}</p>
        </div>
      </div>
    </li>
  );
}
