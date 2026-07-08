import { Input, Label } from "@/components/atoms";

interface ProjectTitleStepProps {
  title: string;
  onTitleChange: (value: string) => void;
  onSubmit: () => void;
}

function ProjectTitleStep({
  title,
  onTitleChange,
  onSubmit,
}: ProjectTitleStepProps) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl space-y-8">
        <div className="space-y-4 text-start lg:text-center">
          <h1 className="text-[16px] lg:font-[25px] font-bold tracking-tight text-black-500 lg:text-balance text-center">
            What Title Would You Like to Give Your Project?
          </h1>
          <p className="text-[16px] lg:text-[18px] text-black-300 text-center lg:text-pretty">
            Name your project so you can easily track its progress and
            documents.
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
              placeholder="Sample Project"
            />
          </div>
        </form>
      </div>
    </div>
  );
}

ProjectTitleStep.displayName = "ProjectTitleStep";

export { ProjectTitleStep, type ProjectTitleStepProps };
