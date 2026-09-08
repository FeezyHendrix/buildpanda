import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TakeoffList } from "@/components/molecules/proposal-plans/takeoff-list";
import { TakeoffLinesView } from "@/components/molecules/proposal-plans/takeoff-lines-view";
import { defaultTakeoff, groupTakeoffs } from "@/components/molecules/proposal-plans/takeoff-groups";
import { useCreateBlankPreconSession, usePreconSessions } from "@/hooks/use-precon";
import { useProposalTakeoffs } from "@/hooks/use-proposals";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";

interface Props {
  proposalId: string;
}

// The take-off is the bill of quantities. This tab lists every take-off on the
// proposal and shows the selected one's lines read-only; editing happens in
// the take-off workspace, where evidence and verification live.
export function TakeoffsTab({ proposalId }: Props) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: sessions = [] } = usePreconSessions(proposalId);
  const { data: jobs = [] } = useProposalTakeoffs(proposalId);
  const createBlank = useCreateBlankPreconSession();
  const [fallbackId, setFallbackId] = useState<string | null>(null);

  const requested = searchParams.get("takeoff");
  const selectedId = requested ?? fallbackId ?? defaultTakeoff(groupTakeoffs(sessions))?.id ?? null;

  function select(sessionId: string) {
    setFallbackId(sessionId);
    const next = new URLSearchParams(searchParams);
    next.set("takeoff", sessionId);
    setSearchParams(next, { replace: true });
  }

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
    <div className="flex flex-col gap-4">
      <TakeoffList
        proposalId={proposalId}
        sessions={sessions}
        jobs={jobs}
        selectedId={selectedId}
        onSelect={select}
        onCreateBlank={createBlankSheet}
        creatingBlank={createBlank.isPending}
      />
      {selectedId ? <TakeoffLinesView sessionId={selectedId} /> : null}
    </div>
  );
}
TakeoffsTab.displayName = "TakeoffsTab";
