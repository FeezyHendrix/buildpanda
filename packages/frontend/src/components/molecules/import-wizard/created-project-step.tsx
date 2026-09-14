import { Button } from "@/components/atoms/button";

interface CreatedProjectStepProps {
  onContinue: () => void;
  pending: boolean;
  error: string | null;
}

export function CreatedProjectStep({ onContinue, pending, error }: CreatedProjectStepProps) {
  return <div className="mx-auto mt-4 flex max-w-2xl flex-col gap-4">
    <h2 className="text-2xl font-semibold text-ink">Your project has been created</h2>
    <p className="text-ink-muted">Continue to finish setting up this project.</p>
    {error ? <p role="alert" className="text-sm text-negative-500">{error}</p> : null}
    <Button onClick={onContinue} loading={pending}>Continue with the saved project</Button>
  </div>;
}
CreatedProjectStep.displayName = "CreatedProjectStep";
