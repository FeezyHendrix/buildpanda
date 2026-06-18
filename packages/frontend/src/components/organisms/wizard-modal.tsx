import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import Navbar from "@/components/organisms/navbar";
import { StepperBar } from "@/components/atoms/stepper-bar";
import { WizardFooter } from "@/components/molecules/wizard-footer";
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
}

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
}: WizardLayoutProps) {
  const { data: session } = authClient.useSession();
  
  const user = {
    name: session?.user?.name ?? "",
    avatarUrl: session?.user?.image ?? null,
  };

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
