"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { faq, type FaqItem as FaqItemData } from "@/content/faq";
import { AskQuestion } from "./ask-question";
import { FaqItem } from "./faq-item";

/** Every word typed must appear somewhere in the question or its answer. */
function matches(item: FaqItemData, words: string[]) {
  const text = `${item.question} ${item.answer}`.toLowerCase();
  return words.every((word) => text.includes(word));
}

/** The search box and the accordion it filters. One answer is open at a time. */
export function FaqExplorer({ items }: { items: ReadonlyArray<FaqItemData> }) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);

  const visible = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return words.length === 0 ? items : items.filter((item) => matches(item, words));
  }, [items, query]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const first = visible[0];
    if (!first) return;
    setOpenId(first.id);
    document.getElementById(`faq-${first.id}`)?.focus();
  };

  return (
    <div className="mx-auto mt-8 max-w-[42rem]">
      <form role="search" onSubmit={onSubmit} className="relative">
        <label htmlFor="faq-search" className="sr-only">
          {faq.search.label}
        </label>
        <Sparkles aria-hidden="true" strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-brand" />
        <input
          id="faq-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={faq.search.placeholder}
          autoComplete="off"
          className="faq-search h-11 w-full border border-line bg-white pr-12 pl-10 text-[0.9375rem] placeholder:text-ink-soft"
        />
        <button
          type="submit"
          aria-label={faq.search.submit}
          className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-brand text-white after:absolute after:-inset-2"
        >
          <ArrowRight aria-hidden="true" strokeWidth={2} className="size-4" />
        </button>
      </form>

      <p aria-live="polite" className="sr-only">
        {query ? `${visible.length} of ${items.length} questions match.` : ""}
      </p>

      {visible.length > 0 ? (
        <ul className="mt-4 border border-line bg-white">
          {visible.map((item) => (
            <FaqItem
              key={item.id}
              item={item}
              open={openId === item.id}
              onToggle={() => setOpenId((current) => (current === item.id ? null : item.id))}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-4 border border-line bg-white px-4 py-5 text-[0.9375rem]">{faq.search.empty}</p>
      )}

      {query.trim().length >= 3 ? <AskQuestion question={query} /> : null}
    </div>
  );
}
