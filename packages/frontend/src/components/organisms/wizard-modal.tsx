import { type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { ReactSVG } from "react-svg";
import { cn } from "@/lib/utils";
import { icons } from "@/assets/icons/icons";
import Navbar from "@/components/organisms/navbar";
import { StepperBar } from "@/components/atoms/stepper-bar";
import { WizardFooter } from "@/components/molecules/wizard-footer";
import { Button } from "@/components/atoms/button";
import { authClient } from "@/lib/auth-client";

interface WizardLayoutProps {
  currentStep: number;
  totalSteps: number;
  onCancel: () => void;
  onContinue: () => void;
  continueDisabled?: boolean;
  continueLabel?: string;
  hideStepper?: boolean;
  hideContinue?: boolean;
  children: ReactNode;
  className?: string;
  /** When set, renders the new minimal wizard header instead of the main Navbar. */
  title?: string;
  /** Named steps listed down the left rail, with "Step n of N" above them (requires title). */
  namedSteps?: string[];
  /** 0-indexed active named step (requires namedSteps). */
  activeNamedStep?: number;
  /** When set, shows a back/previous button on the LEFT of the new-design footer. */
  backLabel?: string;
  /** Called when the back button in the footer is clicked (new design only). */
  onBack?: () => void;
  /** An optional second action beside Continue, e.g. "Skip" (new design only). */
  secondaryLabel?: string;
  onSecondary?: () => void;
}

// ── New-design sub-components ─────────────────────────────────────────────────

function ArrowLeftIcon() {
  return <ArrowLeft className="size-5" strokeWidth={1.5} aria-hidden />;
}

function WizardHeader({ title, onCancel }: { title: string; onCancel: () => void }) {
  return (
    <header className="sticky top-0 z-40 flex h-[68px] shrink-0 items-center border-b border-[#EEEEEE] bg-white px-6 lg:px-[80px]">
      {/* Left: cancel */}
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-[8px] text-[14px] font-medium text-[#1E1E1E] outline-none transition-opacity hover:opacity-60 focus-visible:ring-2 focus-visible:ring-gray-900/10"
      >
        <ArrowLeftIcon />
        Cancel
      </button>

      {/* Center: title (absolute to stay truly centered) */}
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-[14px] font-semibold text-black">
        {title}
      </span>
    </header>
  );
}

/** "Step 2 of 3" over the named steps: the current one filled, finished ones ticked. */
function WizardRail({ steps, activeStep }: { steps: string[]; activeStep: number }) {
  return (
    <nav aria-label="Progress">
      <p className="text-[24px] font-bold leading-[32px] tracking-[-0.04em] text-[#1E1E1E]">
        Step {activeStep + 1} of {steps.length}
      </p>
      <ol className="mt-[16px]">
        {steps.map((label, i) => (
          <li
            key={label}
            aria-current={i === activeStep ? "step" : undefined}
            className={cn(
              "flex h-[54px] items-center justify-between px-[16px] text-[16px] font-semibold leading-[24px] tracking-[-0.02em]",
              i === activeStep && "bg-[#E6EDFD] text-primary",
              i < activeStep && "text-[#1E1E1E]",
              i > activeStep && "text-[#737373]",
            )}
          >
            {label}
            {i < activeStep ? (
              <>
                <ReactSVG src={icons.verifiedCheck} className="[&_svg]:size-5" aria-hidden />
                <span className="sr-only">completed</span>
              </>
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// ── Main layout ───────────────────────────────────────────────────────────────

function WizardLayout({
  currentStep,
  totalSteps,
  onCancel,
  onContinue,
  continueDisabled = false,
  continueLabel = "Continue",
  hideStepper = false,
  hideContinue = false,
  children,
  className,
  title,
  namedSteps,
  activeNamedStep = 0,
  backLabel,
  onBack,
  secondaryLabel,
  onSecondary,
}: WizardLayoutProps) {
  const { data: session } = authClient.useSession();
  const isNewDesign = Boolean(title);

  const user = {
    name: session?.user?.name ?? "",
    avatarUrl: session?.user?.image ?? null,
  };

  if (isNewDesign) {
    return (
      <div className="flex h-dvh flex-col bg-white">
        <WizardHeader title={title!} onCancel={onCancel} />

        <main className={cn("flex-1 overflow-y-auto", className)}>
          <div className="mx-auto grid w-full max-w-[calc(1083px+3rem)] gap-x-[128px] gap-y-8 px-6 pb-10 pt-[40px] lg:grid-cols-[326px_minmax(0,1fr)]">
            {namedSteps && namedSteps.length > 0 && !hideStepper ? (
              // Sticky, so the rail stays put while the content beside it scrolls.
              <div className="lg:sticky lg:top-[40px] lg:self-start">
                <WizardRail steps={namedSteps} activeStep={activeNamedStep} />
              </div>
            ) : (
              <div className="hidden lg:block" />
            )}
            <div className="min-w-0">{children}</div>
          </div>
        </main>

        {!hideContinue && (
          <div className="shrink-0 border-t border-[#EEEEEE] bg-white px-6 py-[16px] lg:px-[80px]">
            <div className={cn("flex items-center gap-[8px]", backLabel ? "justify-between" : "justify-end")}>
              {backLabel && (
                <Button variant="outline" size="lg" onClick={onBack ?? onCancel} className="h-[46px] px-[16px]">
                  {backLabel}
                </Button>
              )}
              <div className="flex items-center gap-[8px]">
                {secondaryLabel && (
                  <Button variant="outline" size="lg" onClick={onSecondary} className="h-[46px] px-[16px]">
                    {secondaryLabel}
                  </Button>
                )}
                <Button variant="primary" size="lg" onClick={onContinue} disabled={continueDisabled} className="h-[46px] px-[16px]">
                  {continueLabel}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Legacy design (used by import wizard) ──────────────────────────────────
  return (
    <div className="flex h-dvh flex-col">
      <Navbar user={user} showLogo sticky />

      <main
        className={cn(
          "mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8",
          className,
        )}
      >
        {!hideStepper && (
          <StepperBar
            currentStep={currentStep}
            totalSteps={totalSteps}
            className="mx-auto w-full max-w-[900px]"
          />
        )}

        <div className="mt-8 flex-1">{children}</div>

        {!hideContinue && (
          <WizardFooter
            onCancel={onCancel}
            onContinue={onContinue}
            continueDisabled={continueDisabled}
            continueLabel={continueLabel}
            className="mt-8"
          />
        )}
      </main>
    </div>
  );
}

WizardLayout.displayName = "WizardLayout";

export { WizardLayout, type WizardLayoutProps };
