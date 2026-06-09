import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import Navbar from "@/components/organisms/navbar";
import { StepperBar } from "@/components/atoms/stepper-bar";
import { WizardFooter } from "@/components/molecules/wizard-footer";

const MOCK_USER = {
  name: "John Doe",
  avatarUrl: null,
};

interface WizardLayoutProps {
  currentStep: number;
  totalSteps: number;
  onCancel: () => void;
  onContinue: () => void;
  continueDisabled?: boolean;
  continueLabel?: string;
  hideStepper?: boolean;
  children: ReactNode;
  className?: string;
}

function WizardLayout({
  currentStep,
  totalSteps,
  onCancel,
  onContinue,
  continueDisabled = false,
  continueLabel = "Continue",
  hideStepper = false,
  children,
  className,
}: WizardLayoutProps) {
  return (
    <div className="flex h-dvh flex-col">
      <Navbar user={MOCK_USER} showLogo sticky />

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

        <WizardFooter
          onCancel={onCancel}
          onContinue={onContinue}
          continueDisabled={continueDisabled}
          continueLabel={continueLabel}
          className="mt-8"
        />
      </main>
    </div>
  );
}

WizardLayout.displayName = "WizardLayout";

export { WizardLayout, type WizardLayoutProps };
