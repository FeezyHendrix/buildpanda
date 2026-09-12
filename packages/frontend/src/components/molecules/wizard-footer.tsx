import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/atoms/button";

interface WizardFooterProps {
  onCancel: () => void;
  onContinue: () => void;
  continueLabel?: string;
  cancelLabel?: string;
  continueDisabled?: boolean;
  helpText?: ReactNode;
  className?: string;
}

function WizardFooter({
  onCancel,
  onContinue,
  continueLabel = "Continue",
  cancelLabel = "Back",
  continueDisabled = false,
  helpText = (
    <span className="text-sm text-gray-500">
      Need help?{" "}
      <a
        href="mailto:support@buildpanda.com"
        className="font-medium text-primary-500 hover:underline"
      >
        Contact Support
      </a>
    </span>
  ),
  className,
}: WizardFooterProps) {
  return (
    <div
      className={cn(
        "flex flex-col lg:flex-row gap-4 lg:gap-0 items-center justify-between border-t border-line-hair pt-6",
        className,
      )}
    >
      <div>{helpText}</div>

      <div className="flex items-center gap-3 w-full lg:w-auto">
        <Button
          variant="ghost"
          size="md"
          onClick={onCancel}
          className="text-primary-500 hover:bg-primary-500/5 active:bg-primary-500/10 w-full lg:auto"
        >
          {cancelLabel}
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={onContinue}
          disabled={continueDisabled}
          className='w-full lg:w-auto'
        >
          {continueLabel}
        </Button>
      </div>
    </div>
  );
}

WizardFooter.displayName = "WizardFooter";

export { WizardFooter, type WizardFooterProps };
