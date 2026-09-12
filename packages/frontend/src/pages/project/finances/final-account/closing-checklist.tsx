import { Card } from "@/components/atoms/card";
import { cn } from "@/lib/utils";
import type { Settlement } from "../settlement-statement";

interface Step {
  title: string;
  detail: string;
  done: (s: Settlement) => boolean;
}

const STEPS: readonly Step[] = [
  {
    title: "Certify remaining work",
    detail: "Value the last activities and record them against the adjusted contract sum.",
    done: (s) => s.remainingToCertify === 0,
  },
  {
    title: "Log the final release",
    detail: "Record the outstanding balance as released once the contractor is paid off-platform.",
    done: (s) => s.outstanding === 0,
  },
  {
    title: "Release retention",
    detail: "Release the retention held after the defects liability period ends.",
    done: (s) => s.retentionHeld === 0,
  },
];

function ChecklistItem({ step, index, done }: { step: Step; index: number; done: boolean }) {
  return (
    <li className="flex gap-3">
      <span
        className={cn(
          "mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full text-xs",
          done ? "bg-success-50 text-success-700" : "bg-neutral-50 text-ink-muted",
        )}
      >
        {done ? "✓" : index + 1}
      </span>
      <div>
        <p className="font-medium text-ink">{step.title}</p>
        <p className="text-xs text-ink-muted">{step.detail}</p>
      </div>
    </li>
  );
}

/** Bookkeeping-only checklist for closing the contract; BuildPanda logs these, it does not move money. */
export function ClosingChecklist({ settlement }: { settlement: Settlement }) {
  return (
    <Card padding="lg" className="lg:col-span-2">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-ink-muted">What happens next</h3>
        <p className="mt-1 text-xs text-ink-muted">
          Bookkeeping-only checklist for closing this contract. BuildPanda logs these actions — it
          does not move money.
        </p>
      </div>
      <ul className="space-y-3 text-sm text-ink">
        {STEPS.map((step, index) => (
          <ChecklistItem key={step.title} step={step} index={index} done={step.done(settlement)} />
        ))}
      </ul>
    </Card>
  );
}

ClosingChecklist.displayName = "ClosingChecklist";
