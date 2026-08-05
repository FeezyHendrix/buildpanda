import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
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
  /** Named step labels shown in the 2-segment progress bar (requires title). */
  namedSteps?: string[];
  /** 0-indexed active named step (requires namedSteps). */
  activeNamedStep?: number;
  /** When set, shows a back/previous button on the LEFT of the new-design footer. */
  backLabel?: string;
  /** Called when the back button in the footer is clicked (new design only). */
  onBack?: () => void;
}

// ── New-design sub-components ─────────────────────────────────────────────────

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WizardHeader({ title, onCancel }: { title: string; onCancel: () => void }) {
  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center border-b border-[#F0F0F0] bg-white px-8">
      {/* Left: cancel */}
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-1.5 text-sm font-medium text-[#1E1E1E] transition-opacity hover:opacity-60"
      >
        <ArrowLeftIcon />
        Cancel
      </button>

      {/* Center: title (absolute to stay truly centered) */}
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-caption-l font-semibold text-black">
        {title}
      </span>

      {/* Right: spacer matching cancel width so the title stays centred */}
      <div className="ml-auto w-16" />
    </header>
  );
}

function WizardNamedProgress({
  steps,
  activeStep,
}: {
  steps: string[];
  activeStep: number;
}) {
  return (
    <div className="flex gap-6 w-full shrink-0">
      {steps.map((label, i) => (
        <div key={label} className="flex-1 gap-4">
          {/* bar */}
          <div
            className={cn(
              "h-[3px]",
              i <= activeStep ? "bg-primary" : "bg-border",
            )}
          />
          {/* label */}
          <p
            className={cn(
              "px-8 py-2.5 text-caption-l font-medium text-center",
              i < activeStep && "font-semibold text-primary",
              i === activeStep && "font-semibold text-primary",
              i > activeStep && "font-medium text-grey-450",
            )}
          >
            {label}
          </p>
        </div>
      ))}
    </div>
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

        {namedSteps && namedSteps.length > 0 && !hideStepper && (
          <WizardNamedProgress steps={namedSteps} activeStep={activeNamedStep} />
        )}

        <main className={cn("flex-1 overflow-y-auto", className)}>
          <div className="mx-auto max-w-[636px] px-6 py-10">
            {children}
          </div>
        </main>

        {!hideContinue && (
          <div className="shrink-0 border-t border-[#F0F0F0] bg-white px-8 py-5">
            <div className={cn("flex items-center", backLabel ? "justify-between" : "justify-end")}>
              {backLabel && (
                <Button variant="outline" size="md" onClick={onBack ?? onCancel}>
                  {backLabel}
                </Button>
              )}
              <Button
                variant="primary"
                size="md"
                onClick={onContinue}
                disabled={continueDisabled}
              >
                {continueLabel}
              </Button>
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
