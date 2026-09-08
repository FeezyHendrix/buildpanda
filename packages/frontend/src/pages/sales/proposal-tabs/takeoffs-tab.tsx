import { TakeoffTable } from "@/components/molecules/proposal-plans/takeoff-table";
import { usePreconSessions } from "@/hooks/use-precon";

interface Props {
  proposalId: string;
}

// The take-off is the unpriced bill of quantities. This tab lists every
// current take-off on the proposal as one table; a row opens the take-off
// workspace, where the lines, evidence and verification live.
export function TakeoffsTab({ proposalId }: Props) {
  const { data: sessions = [], isPending } = usePreconSessions(proposalId);
  return <TakeoffTable sessions={sessions} isLoading={isPending} />;
}
TakeoffsTab.displayName = "TakeoffsTab";
