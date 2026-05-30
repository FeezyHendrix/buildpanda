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
        className="font-medium text-[#004DE7] hover:underline"
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
        "flex items-center justify-between border-t border-[#F6F6F6] pt-6",
        className,
      )}
    >
      <div>{helpText}</div>

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="md"
          onClick={onCancel}
          className="text-[#004DE7] hover:bg-[#004DE7]/5 active:bg-[#004DE7]/10"
        >
          {cancelLabel}
        </Button>
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
  );
}

WizardFooter.displayName = "WizardFooter";

export { WizardFooter, type WizardFooterProps };
