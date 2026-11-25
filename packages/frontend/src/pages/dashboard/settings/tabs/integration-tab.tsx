import { Badge, EmptyState } from "@/components";
import emptyIcon from "@/assets/images/empty-Integration.png";

export function IntegrationTab() {
  return (
    <div className="flex flex-col gap-6 items-center justify-center py-10">
      <Badge dot tone='success' className='py-2'>Coming soon</Badge>
      <EmptyState
        illustration={<img src={emptyIcon} alt="" className="mb-8 h-auto w-100 max-w-full" />}
        title="Integrations"
        description="We're working on connecting BuildPanda with your favorite tools. Check back later."
        className="flex flex-col gap-8 max-w-4xl"
      />
    </div>
  );
}
