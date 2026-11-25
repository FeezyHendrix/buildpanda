import { Check } from "lucide-react";
import { Link } from "react-router-dom";
import { useProjectContext } from "@/layouts/project-layout";
import type { FinanceSummary } from "@/hooks/use-finances";
import { cn } from "@/lib/utils";
import { SheetHeading } from "../contracts-phases/sheet-parts";

interface Step {
  title: string;
  detail: string;
  done: (s: FinanceSummary) => boolean;
  to: string;
}

const STEPS: readonly Step[] = [
  {
    title: "Certify remaining work",
    to: "finances/budget-invoices?tab=invoices",
    detail: "Value the last activities and record them against the adjusted contract sum.",
    done: (s) => s.outstanding === 0,
  },
  {
    title: "Record the final receipt",
    to: "finances/budget-invoices?tab=payments",
    detail: "Log the last payment against the certificates once the employer has paid off-platform.",
    done: (s) => s.unpaidCertified === 0,
  },
  {
    title: "Release retention",
    to: "finances/budget-invoices?tab=invoices",
    detail: "Release the retention held after the defects liability period ends.",
    done: (s) => s.retentionHeld === 0,
  },
];

function StepMarker({ done }: { done: boolean }) {
  if (done) {
    return (
      <span className="flex size-[16px] items-center justify-center rounded-full bg-[#00A63E] text-white">
        <Check className="size-[11px]" strokeWidth={3} aria-hidden />
      </span>
    );
  }
  return <span className="size-[16px] rounded-full border-[4px] border-[#E5E5E5] bg-white" />;
}

function ChecklistItem({ step, done }: { step: Step; done: boolean }) {
  const { project } = useProjectContext();
  return (
    <li className="flex min-h-[73px] items-center gap-[21px] border-b border-[#EEEEEE] py-[8px] last:border-b-0">
      <span aria-hidden="true" className="flex w-[18px] shrink-0 items-center pl-[2px]">
        <StepMarker done={done} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-caption-l text-[#1E1E1E]">
          {step.title}
          {done ? <span className="sr-only"> (done)</span> : null}
        </p>
        <p className="text-caption-m text-[#737373]">{step.detail}</p>
      </div>
      {!done ? (
        <Link
          to={`/project/${project.id}/${step.to}`}
          className={cn(
            "inline-flex h-[38px] shrink-0 items-center border border-[#E5E5E5] bg-white px-[16px]",
            "text-caption-l font-medium text-[#1E1E1E] outline-none transition-colors hover:bg-[#F6F6F6]",
            "focus-visible:ring-2 focus-visible:ring-[#004DE7]/25",
          )}
        >
          Open related records
        </Link>
      ) : null}
    </li>
  );
}

/** Bookkeeping-only checklist for closing the contract; BuildPanda logs these, it does not move money. */
export function ClosingChecklist({ summary }: { summary: FinanceSummary }) {
  return (
    <section aria-label="What happens next">
      <SheetHeading>What happens next</SheetHeading>
      <p className="mt-[6px] text-caption-m text-[#737373]">
        Bookkeeping-only checklist for closing this contract. BuildPanda logs these actions — it does not move money.
      </p>
      <ul className="mt-[17px]">
        {STEPS.map((step) => (
          <ChecklistItem key={step.title} step={step} done={step.done(summary)} />
        ))}
      </ul>
    </section>
  );
}

ClosingChecklist.displayName = "ClosingChecklist";
