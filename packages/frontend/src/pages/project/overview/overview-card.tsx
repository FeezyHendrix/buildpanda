import type { HTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface OverviewCardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title: string;
  /** Right side of the header bar, usually a `CardHeaderLink`. */
  action?: ReactNode;
  children: ReactNode;
}

/**
 * The overview's one card: square corners, hairline border and a 33px title
 * bar. Every panel on the page renders through it so they read as one set.
 */
export function OverviewCard({ title, action, children, className, ...rest }: OverviewCardProps) {
  return (
    <section className={cn("flex min-w-0 flex-col border border-[#EEEEEE] bg-white", className)} {...rest}>
      <header className="flex h-[33px] shrink-0 items-center justify-between gap-3 border-b border-[#EEEEEE] px-[14px]">
        <h3 className="truncate text-[14px] font-medium leading-[20px] text-[#1E1E1E]">{title}</h3>
        {action}
      </header>
      {children}
    </section>
  );
}

OverviewCard.displayName = "OverviewCard";

const HEADER_LINK_CLASS =
  "inline-flex shrink-0 items-center gap-[5px] text-[12px] font-semibold leading-[16px] text-[#004DE7] hover:underline";

/** "↗ View All" — the blue action in a card's title bar. */
export function CardHeaderLink({ children, ...props }: LinkProps) {
  return (
    <Link className={HEADER_LINK_CLASS} {...props}>
      <ArrowUpRight className="size-[14px]" strokeWidth={2} aria-hidden />
      {children}
    </Link>
  );
}

CardHeaderLink.displayName = "CardHeaderLink";

/** Same look as `CardHeaderLink` for actions that change this page rather than navigate. */
export function CardHeaderButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={HEADER_LINK_CLASS}>
      <ArrowUpRight className="size-[14px]" strokeWidth={2} aria-hidden />
      {children}
    </button>
  );
}

CardHeaderButton.displayName = "CardHeaderButton";

/** The spaced-out caps label used for in-card sections ("NEXT KEY DATES"). */
export function SectionEyebrow({ children, className }: { children: string; className?: string }) {
  return (
    <p className={cn("text-[12px] font-bold uppercase leading-[16px] tracking-[0.2em] text-[#1E1E1E]", className)}>
      {children}
    </p>
  );
}

SectionEyebrow.displayName = "SectionEyebrow";
