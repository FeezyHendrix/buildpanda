import { Dialog } from "@base-ui/react/dialog";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/atoms/button";
import { DrawerCloseButton } from "@/components/molecules/drawer-chrome";
import type { DiscoveryInput, DiscoveryQuestionKey } from "@/api/product-discovery";
import { useCloseProductDiscovery, useProductDiscovery, useSaveProductDiscovery } from "@/hooks/use-product-discovery";

const CALENDLY_URL = "https://calendly.com/innocent-buildpanda/30min";
const CALENDLY_ORIGIN = "https://calendly.com";
const CALENDLY_SCRIPT = "https://assets.calendly.com/assets/external/widget.js";

interface CalendlyWindow {
  Calendly?: { initInlineWidget(options: { url: string; parentElement: HTMLElement }): void };
}

interface Field {
  key: DiscoveryQuestionKey;
  label?: string;
  multi?: boolean;
}

const STEPS: { title: string; hint: string; fields: Field[] }[] = [
  {
    title: "What do you want to use BuildPanda for?",
    hint: "Pick everything that applies.",
    fields: [{ key: "useCases", multi: true }],
  },
  {
    title: "How did you hear about BuildPanda?",
    hint: "Pick everything that applies.",
    fields: [{ key: "referralSources", multi: true }],
  },
  {
    title: "Tell us about your work",
    hint: "This helps us show you the parts of BuildPanda that fit how you build.",
    fields: [
      { key: "role", label: "Your role" },
      { key: "teamSize", label: "People in your company" },
      { key: "activeProjects", label: "Projects running right now" },
      { key: "currentTools", label: "How you manage projects today", multi: true },
    ],
  },
];
const DEMO_STEP = STEPS.length;

type Answers = Record<DiscoveryQuestionKey, string[]>;
const EMPTY: Answers = { useCases: [], referralSources: [], currentTools: [], role: [], teamSize: [], activeProjects: [] };

function toInput(a: Answers): DiscoveryInput {
  return {
    useCases: a.useCases,
    referralSources: a.referralSources,
    currentTools: a.currentTools,
    role: a.role[0],
    teamSize: a.teamSize[0],
    activeProjects: a.activeProjects[0],
  };
}

interface OptionFieldProps {
  field: Field;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}

function OptionField({ field, options, selected, onChange }: OptionFieldProps) {
  function toggle(option: string) {
    if (!field.multi) return onChange([option]);
    onChange(selected.includes(option) ? selected.filter((o) => o !== option) : [...selected, option]);
  }
  return (
    <fieldset className="flex flex-col gap-2">
      {field.label ? <legend className="mb-2 text-sm font-medium text-gray-900">{field.label}</legend> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 has-[:checked]:border-primary-600 has-[:checked]:bg-primary-50"
          >
            <input
              type={field.multi ? "checkbox" : "radio"}
              name={field.key}
              checked={selected.includes(option)}
              onChange={() => toggle(option)}
              className="size-4 shrink-0 accent-primary-600"
            />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
OptionField.displayName = "OptionField";

// Calendly's own inline widget: its script fills every .calendly-inline-widget when it loads.
function CalendlyEmbed() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const calendly = (window as CalendlyWindow).Calendly;
    if (calendly && ref.current) return calendly.initInlineWidget({ url: CALENDLY_URL, parentElement: ref.current });
    if (document.querySelector(`script[src="${CALENDLY_SCRIPT}"]`)) return;
    const script = document.createElement("script");
    script.src = CALENDLY_SCRIPT;
    script.async = true;
    document.body.appendChild(script);
  }, []);
  return <div ref={ref} className="calendly-inline-widget h-[700px] min-w-80" data-url={CALENDLY_URL} />;
}
CalendlyEmbed.displayName = "CalendlyEmbed";

/** Asks a new signup what they want from BuildPanda the first time they reach the dashboard. */
export function ProductDiscoveryModal() {
  const { data } = useProductDiscovery();
  const save = useSaveProductDiscovery();
  const close = useCloseProductDiscovery();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const open = data?.due === true;
  const onDemo = step === DEMO_STEP;
  const { mutate } = save;

  useEffect(() => {
    if (!open || !onDemo) return;
    function onMessage(e: MessageEvent) {
      if (e.origin === CALENDLY_ORIGIN && e.data?.event === "calendly.event_scheduled") mutate({ demoBooked: true });
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [open, onDemo, mutate]);

  if (!open) return null;
  const current = STEPS[step];

  // Closing early still records what was answered, and that the user has been asked.
  function dismiss() {
    if (!onDemo) save.mutate(toInput(answers));
    close();
  }

  function next() {
    if (step < DEMO_STEP - 1) return setStep(step + 1);
    save.mutate({ ...toInput(answers), completed: true }, { onSuccess: () => setStep(DEMO_STEP) });
  }

  return (
    <Dialog.Root open onOpenChange={(isOpen) => (isOpen ? undefined : dismiss())} disablePointerDismissal>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden bg-white shadow-xl outline-none">
          <header className="flex items-start justify-between gap-4 px-6 pt-6">
            <div>
              <p className="text-xs font-medium text-gray-500">
                Step {step + 1} of {DEMO_STEP + 1}
              </p>
              <Dialog.Title className="mt-1 text-lg font-semibold text-gray-900">
                {current ? current.title : "Want a 30 minute walkthrough?"}
              </Dialog.Title>
              <Dialog.Description className="mt-1.5 text-sm text-gray-500 text-pretty">
                {current ? current.hint : "Pick a time and we will show you around. You can skip this."}
              </Dialog.Description>
            </div>
            <DrawerCloseButton />
          </header>

          <div className="flex flex-col gap-6 overflow-y-auto px-6 py-5">
            {current
              ? current.fields.map((field) => (
                  <OptionField
                    key={field.key}
                    field={field}
                    options={data.questions[field.key] ?? []}
                    selected={answers[field.key]}
                    onChange={(value) => setAnswers((prev) => ({ ...prev, [field.key]: value }))}
                  />
                ))
              : null}
            {/* Mounted from the first step so the calendar is ready when the user reaches it. It sits
                transparent inside the popup rather than hidden: browsers do not render a hidden or
                off-screen cross-origin frame, so Calendly would only start drawing once shown. */}
            <div className={current ? "pointer-events-none absolute inset-x-6 top-0 opacity-0" : undefined} inert={Boolean(current)}>
              <CalendlyEmbed />
            </div>
          </div>

          {save.error ? (
            <p className="mx-6 mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              We could not save your answers. Try again.
            </p>
          ) : null}

          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-[#F0F0F0] px-6 py-4">
            {current ? (
              <>
                <Button type="button" variant="ghost" size="sm" className="mr-auto h-9 px-4 text-sm" onClick={dismiss}>
                  Skip
                </Button>
                {step > 0 ? (
                  <Button type="button" variant="secondary" size="sm" className="h-9 px-4 text-sm" onClick={() => setStep(step - 1)}>
                    Back
                  </Button>
                ) : null}
                <Button type="button" size="sm" className="h-9 px-4 text-sm" loading={save.isPending} onClick={next}>
                  Next
                </Button>
              </>
            ) : (
              <Button type="button" size="sm" className="h-9 px-4 text-sm" onClick={dismiss}>
                Done
              </Button>
            )}
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
ProductDiscoveryModal.displayName = "ProductDiscoveryModal";
