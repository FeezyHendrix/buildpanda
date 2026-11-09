"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { Container, SectionHeading } from "@/components/ui";
import { scenes } from "@/components/home/panda-ai-scenes";

const TYPE_MS = 26;
const HOLD_AFTER_ANSWER_MS = 2600;
const LINE_STAGGER_MS = 420;

/**
 * The section demonstrates rather than describes: it types a real question,
 * answers it, and moves on. Every scene is something the product does today —
 * see panda-ai-scenes.ts. Reduced motion gets the whole thing at rest, all
 * scenes listed and the first one fully answered, so nothing is hidden behind
 * an animation somebody cannot see.
 */
export function PandaAi() {
  const reduced = usePrefersReducedMotion();

  return (
    <section className="bg-surface-muted py-16 sm:py-24 2xl:py-28">
      <Container className="flex flex-col gap-10 2xl:gap-14">
        <SectionHeading
          eyebrow="Panda AI"
          title="Ask the project a question."
          description="It answers from the project's own record, not from the internet and not from a summary somebody typed. If the record does not hold the answer, it says so."
        />
        {reduced ? <SceneList /> : <Player />}
      </Container>
    </section>
  );
}

/** Static equivalent: every scene, with the first one answered. */
function SceneList() {
  return (
    <div className="grid gap-x-10 gap-y-8 border-t border-hairline pt-8 lg:grid-cols-2">
      {scenes.map((scene, index) => (
        <div key={scene.label} className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
            {scene.label}
          </span>
          <p className="text-lg leading-snug text-ink">&ldquo;{scene.ask}&rdquo;</p>
          {index === 0
            ? scene.answer.map((line) => (
                <p key={line} className="text-sm leading-relaxed text-muted">
                  {line}
                </p>
              ))
            : null}
        </div>
      ))}
    </div>
  );
}

function Player() {
  const [index, next] = useReducer((i: number) => (i + 1) % scenes.length, 0);
  const scene = scenes[index]!;
  const typed = useTypewriter(scene.ask, TYPE_MS);
  const asked = typed.length === scene.ask.length;

  // Advance only once the answer has been on screen long enough to read.
  useEffect(() => {
    if (!asked) return;
    const wait = scene.answer.length * LINE_STAGGER_MS + HOLD_AFTER_ANSWER_MS;
    const timer = setTimeout(next, wait);
    return () => clearTimeout(timer);
  }, [asked, scene, next]);

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-12 2xl:gap-16">
      <ol className="flex flex-col border-t border-hairline">
        {scenes.map((item, i) => (
          <li key={item.label}>
            <button
              type="button"
              onClick={() => {
                if (i !== index) next();
              }}
              aria-current={i === index}
              className={`flex w-full items-center gap-3 border-b border-hairline py-3 text-left text-sm transition-colors ${
                i === index ? "text-ink" : "text-muted hover:text-ink"
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 flex-shrink-0 rounded-full transition-colors ${
                  i === index ? "bg-brand" : "bg-hairline"
                }`}
              />
              {item.label}
            </button>
          </li>
        ))}
      </ol>

      <div className="flex min-h-[19rem] flex-col gap-4 rounded-xl border border-line bg-white p-6 shadow-[0_24px_60px_-35px_rgba(13,19,33,0.35)] sm:min-h-[17rem] sm:p-8 2xl:min-h-[19rem] 2xl:p-10">
        <p
          aria-live="polite"
          className="min-h-[3.5rem] text-pretty text-xl leading-snug text-ink sm:min-h-[2.5rem] sm:text-2xl 2xl:text-3xl"
        >
          {typed}
          <span
            aria-hidden="true"
            className={`ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[0.15em] bg-brand ${
              asked ? "opacity-0" : "animate-pulse"
            }`}
          />
        </p>

        <div className="flex min-h-[6.5rem] flex-col gap-2 border-t border-hairline pt-4 sm:min-h-[5.5rem]">
          {asked
            ? scene.answer.map((line, i) => (
                <p
                  key={line}
                  style={{ animationDelay: `${i * LINE_STAGGER_MS}ms` }}
                  className="animate-[answer-in_420ms_ease-out_both] text-sm leading-relaxed text-muted 2xl:text-base"
                >
                  {line}
                </p>
              ))
            : null}
        </div>

        <p className="mt-auto text-[11px] font-semibold uppercase tracking-[0.18em] text-muted/70">
          {scene.source}
        </p>
      </div>
    </div>
  );
}

/** Reveals `text` one character at a time; restarts whenever `text` changes. */
function useTypewriter(text: string, speed: number): string {
  const [count, setCount] = useState(0);
  const textRef = useRef(text);

  useEffect(() => {
    textRef.current = text;
    setCount(0);
    const timer = setInterval(() => {
      setCount((c) => {
        if (c >= textRef.current.length) {
          clearInterval(timer);
          return c;
        }
        return c + 1;
      });
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return text.slice(0, count);
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}
