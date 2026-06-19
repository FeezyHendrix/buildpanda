"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentType, SVGProps } from "react";
import {
  PhoneIcon,
  DocumentIcon,
  ChartIcon,
  BellIcon,
  KeyIcon,
} from "@/components/icons";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const steps: { icon: IconComponent; title: string; description: string }[] = [
  {
    icon: PhoneIcon,
    title: "Have a chat with us",
    description:
      "Tell us what you want to build, your rough budget, and when you'd like to start. No jargon, no pressure just a real conversation about your plans.",
  },
  {
    icon: DocumentIcon,
    title: "We map out your build",
    description:
      "You'll receive a clear, written plan what gets built, when, by whom, and what it costs. Everything is agreed upfront before a single brick is laid.",
  },
  {
    icon: ChartIcon,
    title: "Watch your build happen in real time",
    description:
      "Log in anytime to see photos, daily progress, and exactly where your money is going, even if you're thousands of kilometres away.",
  },
  {
    icon: BellIcon,
    title: "Always in the loop, never in the dark",
    description:
      "Get regular updates from your dedicated advisor and reach your project team directly whenever you need them. No more waiting and wondering.",
  },
  {
    icon: KeyIcon,
    title: "Get your keys, stress-free",
    description:
      "Your project is delivered on time and on budget, with every payment tied to verified work. No nasty surprises just the home you planned for.",
  },
];

export function OnboardingTimeline() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="relative mx-auto max-w-2xl">
      {/* Animated vertical line */}
      <div className="absolute left-5 top-5 bottom-5 w-px bg-line overflow-hidden">
        <div
          className="w-full bg-brand origin-top transition-transform duration-[1400ms] ease-in-out"
          style={{
            height: "100%",
            transform: visible ? "scaleY(1)" : "scaleY(0)",
          }}
        />
      </div>

      <div className="flex flex-col gap-10">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <div
              key={step.title}
              className="relative flex items-start gap-6 transition-all duration-500 ease-out"
              style={{
                transitionDelay: visible ? `${i * 160}ms` : "0ms",
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(16px)",
              }}
            >
              {/* Icon node */}
              <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white shadow-[0_0_0_4px_white]">
                <Icon className="h-4 w-4" />
              </div>

              {/* Content */}
              <div className="flex flex-col gap-1 pb-2 pt-1.5">
                <p className="text-base font-semibold text-ink">{step.title}</p>
                <p className="text-sm leading-relaxed text-muted">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
