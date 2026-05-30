import { ComingSoon } from "@/components/molecules/coming-soon";
import { PageHeader } from "@/components/molecules/page-header";
import { ContractorsIcon } from "@/components/atoms/project-nav-icons";

export default function ProjectContractors() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col px-6 py-8 sm:px-10">
      <PageHeader
        title="Contractors"
        description="Manage vetted contractors, scopes, and performance scores for this project."
      />
      <ComingSoon
        icon={<ContractorsIcon className="size-6" />}
        iconTone="purple"
        title="Contractor management is on the way"
        description="Soon you'll be able to onboard contractors, assign scopes, and review their work history right here."
      />
    </div>
  );
}
