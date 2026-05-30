import { ComingSoon } from "@/components/molecules/coming-soon";
import { PageHeader } from "@/components/molecules/page-header";
import { SettingsIcon } from "@/components/atoms/settings-icon";

export default function ProjectSettings() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col px-6 py-8 sm:px-10">
      <PageHeader
        title="Settings"
        description="Configure project preferences, notification rules, and team access."
      />
      <ComingSoon
        icon={<SettingsIcon className="size-6" />}
        iconTone="gray"
        title="Project settings coming soon"
        description="Granular controls for budget thresholds, notification channels, and team roles are in the works."
      />
    </div>
  );
}
