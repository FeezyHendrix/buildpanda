import { MethodStatementsPanel } from "@/components/molecules/precon-safety/method-statements-panel";
import { PhasePlanForm } from "@/components/molecules/precon-safety/phase-plan-form";
import { RiskRegisterTable } from "@/components/molecules/precon-safety/risk-register-table";
import { usePreconProgramme, usePreconSessions } from "@/hooks/use-precon";

interface Props {
  proposalId: string;
}

// Safety pack for the proposal: register, method statements, phase plan. The
// programme tasks come from the proposal's latest take-off so a statement can
// be linked to the activity it covers; a proposal without a take-off still works.
export function SafetyTab({ proposalId }: Props) {
  const { data: sessions = [] } = usePreconSessions(proposalId);
  const latest = sessions.find((s) => s.status === "reviewing" || s.status === "output") ?? sessions[0];
  const { data: programme } = usePreconProgramme(latest?.id ?? "");
  const programmeTasks = (programme?.tasks ?? [])
    .filter((t) => t.status !== "rejected")
    .map((t) => ({ id: t.id, name: t.name }));

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
        Panda AI drafts each document from the brief, the structure it read off the drawings and the programme. Nothing is
        final until a person confirms it, and every field stays editable afterwards. Confirmed items carry into the project at handoff.
      </div>
      <RiskRegisterTable proposalId={proposalId} />
      <MethodStatementsPanel proposalId={proposalId} programmeTasks={programmeTasks} />
      <PhasePlanForm proposalId={proposalId} />
    </div>
  );
}
SafetyTab.displayName = "SafetyTab";
