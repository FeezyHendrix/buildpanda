import type { ReactNode } from "react";
import logo from "@/assets/images/logo.svg";
import { cn } from "@/lib/utils";

interface StatusPageProps {
  /** Grey first line of the heading. */
  lead: string;
  /** Black second line. */
  emphasis: string;
  description: ReactNode;
  /** Fills the slot (up to 220px, shrinking on short windows so the page never scrolls) between the logo and the heading. The slot is kept even when empty, for the artwork. */
  illustration?: ReactNode;
  /** Buttons row. */
  actions: ReactNode;
  /** Anything under the buttons, e.g. error details. */
  footer?: ReactNode;
}

/** The shared look of the 404 and error pages: logo, illustration, two-tone heading, two buttons. */
export function StatusPage({ lead, emphasis, description, illustration, actions, footer }: StatusPageProps) {
  return (
    // Fixed and above everything, so it takes the whole window even when a layout's
    // error boundary or a nested route renders it inside the sidebar shell.
    <main className="fixed inset-0 z-[100] flex flex-col items-center overflow-y-auto bg-white px-6">
      <header className="flex h-[120px] shrink-0 items-start justify-center pt-[40px]">
        <img src={logo} alt="Build Panda" className="h-[40px] w-auto" />
      </header>

      <div aria-hidden className="flex min-h-0 max-h-[220px] w-full flex-[1_1_220px] items-center justify-center">
        {illustration}
      </div>

      <div className="mt-[36px] flex w-full max-w-[320px] flex-col pb-[48px] items-center text-center">
        <h1 className="text-[30px] font-semibold leading-[36px] tracking-[-0.04em]">
          <span className="block text-[#7F7F7F]">{lead}</span>
          <span className="block text-black">{emphasis}</span>
        </h1>
        <p className="mt-[7px] text-[14px] leading-[20px] text-[#7F7F7F]">{description}</p>
        <div className="mt-[24px] flex flex-wrap items-center justify-center gap-[8px]">{actions}</div>
        {footer ? <div className="mt-[24px]">{footer}</div> : null}
      </div>
    </main>
  );
}

StatusPage.displayName = "StatusPage";

const ACTION_BASE =
  "inline-flex h-[46px] items-center justify-center px-[16px] text-[14px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10";

export const STATUS_ACTION_OUTLINE = cn(ACTION_BASE, "border border-[#DDDDDD] bg-white text-[#1E1E1E] hover:bg-[#F5F5F5]");
export const STATUS_ACTION_PRIMARY = cn(ACTION_BASE, "bg-[#004DE7] text-white hover:bg-[#053DAB] active:bg-[#002061]");
