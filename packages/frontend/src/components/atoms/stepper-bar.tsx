import { cn } from "@/lib/utils";

interface StepperBarProps {
  currentStep: number;
  totalSteps: number;
  className?: string;
}

function StepperBar({ currentStep, totalSteps, className }: StepperBarProps) {
  const percentage = Math.round((currentStep / totalSteps) * 100);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-900">
          Step {currentStep} of {totalSteps}
        </span>
        <span className="font-medium text-[#1AE592]">
          {percentage}% completed
        </span>
      </div>

      <div className="flex gap-1.5">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              i < currentStep ? "bg-[#1AE592]" : "bg-[#F6F6F6]",
            )}
          />
        ))}
      </div>
    </div>
  );
}

StepperBar.displayName = "StepperBar";

export { StepperBar, type StepperBarProps };
