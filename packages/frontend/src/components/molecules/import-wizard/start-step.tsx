import { OptionCard } from "@/components/atoms/option-card";
import milestoneIcon from "@/assets/icons/milestone-icon.svg";
import buildHomeIcon from "@/assets/icons/build-a-new-home-icon.svg";
import folderIcon from "@/assets/icons/folder.colored.icon.svg";

interface StartStepProps {
  onSelect: (mode: "programme" | "shell" | "file") => void;
  isCreating: boolean;
}

export function StartStep({ onSelect, isCreating }: StartStepProps) {
  return (
    <div className="flex flex-col items-center max-w-2xl mx-auto text-center mt-12">
      <h1 className="text-3xl font-semibold text-gray-900 mb-4">
        Set up a project
      </h1>
      <p className="text-gray-500 mb-12">
        Choose how you want to start. You can build your project from an existing schedule, or start from scratch.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
        <OptionCard
          title="I have a project file"
          subtitle="Upload an Excel handover doc or workbook. We'll extract the structured details automatically."
          icon={<img src={folderIcon} alt="" className="size-12" />}
          selected={false}
          onClick={() => {
            if (!isCreating) onSelect("file");
          }}
        />
        <OptionCard
          title="Start from a programme"
          subtitle="Upload an .mpp or Excel schedule. We'll extract activities, milestones, and build the project structure automatically."
          icon={<img src={milestoneIcon} alt="" className="size-12" />}
          selected={false}
          onClick={() => {
            if (!isCreating) onSelect("programme");
          }}
        />
        <OptionCard
          title="Start from scratch / details"
          subtitle="Enter manual details. Best if you don't have a schedule yet, or if you only have a BoQ or drawings."
          icon={<img src={buildHomeIcon} alt="" className="size-12" />}
          selected={false}
          onClick={() => {
            if (!isCreating) onSelect("shell");
          }}
        />
      </div>
    </div>
  );
}
