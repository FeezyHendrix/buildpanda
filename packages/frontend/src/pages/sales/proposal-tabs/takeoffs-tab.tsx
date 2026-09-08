import { useNavigate } from "react-router-dom";
import { TakeoffTable } from "@/components/molecules/proposal-plans/takeoff-table";
import { useCreateBlankPreconSession, usePreconSessions } from "@/hooks/use-precon";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";

interface Props {
  proposalId: string;
}

// The take-off is the unpriced bill of quantities. This tab lists every
// take-off on the proposal as one table; a row opens the take-off workspace,
// where the lines, evidence and verification live.
export function TakeoffsTab({ proposalId }: Props) {
  const navigate = useNavigate();
  const { data: sessions = [], isPending } = usePreconSessions(proposalId);
  const createBlank = useCreateBlankPreconSession();

  function createBlankSheet() {
    createBlank.mutate(
      { title: "Untitled take-off", proposalId },
      {
        onSuccess: (session) => navigate(`/sales/takeoff/${session.id}`),
        onError: (err) => toast(getApiErrorMessage(err, "Could not create the take-off."), "error"),
      },
    );
  }

  return (
    <TakeoffTable
      proposalId={proposalId}
      sessions={sessions}
      isLoading={isPending}
      onCreateBlank={createBlankSheet}
      creatingBlank={createBlank.isPending}
    />
  );
}
TakeoffsTab.displayName = "TakeoffsTab";
