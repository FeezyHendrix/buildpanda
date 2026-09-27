import { Input, Label } from "@/components/atoms";
import { INPUT_CLASS } from "@/components/atoms/input";

export interface ProjectContractDetails {
  clientName: string;
  startDate: string;
  completionDate: string;
}

interface ProjectTitleStepProps {
  title: string;
  contract: ProjectContractDetails;
  onTitleChange: (value: string) => void;
  onContractChange: (value: ProjectContractDetails) => void;
  onSubmit: () => void;
}

function ProjectTitleStep({
  title,
  contract,
  onTitleChange,
  onContractChange,
  onSubmit,
}: ProjectTitleStepProps) {
  const datesInverted = Boolean(
    contract.startDate && contract.completionDate && contract.completionDate < contract.startDate,
  );

  function update<K extends keyof ProjectContractDetails>(
    key: K,
    value: ProjectContractDetails[K],
  ): void {
    onContractChange({ ...contract, [key]: value });
  }

  return (
    <div className="flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl space-y-8">
        <div className="space-y-4 text-start lg:text-center">
          <h1 className="text-center text-[16px] font-medium tracking-tight text-black-500 lg:font-[25px] lg:text-balance">
            Name the project and set its contract dates
          </h1>
          <p className="text-center text-[16px] text-black-300 lg:text-[18px] lg:text-pretty">
            The dates are the frame every schedule figure is measured against. You can
            change all of this later in Settings.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) onSubmit();
          }}
          className="space-y-6"
        >
          <div className="space-y-3">
            <Label htmlFor="project-title">Project title</Label>
            <Input
              id="project-title"
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="e.g. Ikorodu–Sagamu Link Road Rehabilitation (Section 2)"
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="project-client">Client / employer (optional)</Label>
            <Input
              id="project-client"
              type="text"
              value={contract.clientName}
              onChange={(e) => update("clientName", e.target.value)}
              placeholder="e.g. Lagos State Ministry of Works"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <Label htmlFor="project-start">Commencement date</Label>
              <input
                id="project-start"
                type="date"
                value={contract.startDate}
                onChange={(e) => update("startDate", e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="project-completion">Contract completion date</Label>
              <input
                id="project-completion"
                type="date"
                value={contract.completionDate}
                aria-invalid={datesInverted || undefined}
                onChange={(e) => update("completionDate", e.target.value)}
                className={INPUT_CLASS}
              />
              {datesInverted ? (
                <p className="text-xs text-negative-600">
                  Completion must not be before commencement.
                </p>
              ) : null}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

ProjectTitleStep.displayName = "ProjectTitleStep";

export { ProjectTitleStep, type ProjectTitleStepProps };
