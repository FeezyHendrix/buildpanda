import { EmptyState } from "@/components/molecules/empty-state";

interface Props {
  proposalId: string;
}

// Placeholder: the Pack tab (scope, exclusions, assumptions, warranties, terms,
// permits, compliance documents) is built by the pack workstream (WS-4). This
// keeps the tab set stable so links and the URL `?tab=pack` already resolve.
export function PackTab({ proposalId }: Props) {
  return (
    <EmptyState
      title="Proposal pack"
      description={`Scope, exclusions, assumptions, warranties, terms and compliance documents for proposal ${proposalId} will live here.`}
      className="py-16"
    />
  );
}
PackTab.displayName = "PackTab";
