import { ComingSoon } from "@/components/molecules/coming-soon";
import { PageHeader } from "@/components/molecules/page-header";
import { MaterialsIcon } from "@/components/atoms/project-nav-icons";

export default function ProjectMaterials() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col px-6 py-8 sm:px-10">
      <PageHeader
        title="Materials"
        description="Track procurement, deliveries, and on-site material inventory across every phase."
      />
      <ComingSoon
        icon={<MaterialsIcon className="size-6" />}
        iconTone="orange"
        title="Materials catalog launching soon"
        description="We're polishing supplier integrations, delivery tracking, and stock-level alerts. Hang tight."
      />
    </div>
  );
}
