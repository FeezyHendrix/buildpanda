import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { Spinner } from "@/components/atoms/spinner";
import type { ProposalRisk } from "@/api/precon-safety";
import {
  useConfirmProposalRisk,
  useCreateProposalRisk,
  useDeleteProposalRisk,
  useDraftProposalRisks,
  useProposalRisks,
  useUpdateProposalRisk,
} from "@/hooks/use-precon-safety";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { RiskRow } from "./risk-row";
import { DraftButton } from "./safety-shared";

interface Props {
  proposalId: string;
}

const HEADERS = ["Risk", "Likelihood", "Impact", "Score", "Owner", "Status", "Review", ""] as const;

export function RiskRegisterTable({ proposalId }: Props) {
  const { data: risks = [], isPending, isError, error } = useProposalRisks(proposalId);
  const create = useCreateProposalRisk(proposalId);
  const update = useUpdateProposalRisk(proposalId);
  const confirm = useConfirmProposalRisk(proposalId);
  const remove = useDeleteProposalRisk(proposalId);
  const draft = useDraftProposalRisks(proposalId);
  const [removeTarget, setRemoveTarget] = useState<ProposalRisk | null>(null);

  const fail = (fallback: string) => (err: unknown) => toast(getApiErrorMessage(err, fallback), "error");

  const confirmedCount = risks.filter((r) => r.editState === "confirmed").length;

  return (
    <section className="rounded-lg border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-hair px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Risk register</p>
          <p className="text-xs text-gray-500">
            Panda AI drafts from the brief, structure and programme. Every cell is editable; confirming a row signs it off.
            {risks.length > 0 ? ` ${confirmedCount} of ${risks.length} confirmed.` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DraftButton
            label={risks.length > 0 ? "Draft more with Panda AI" : "Draft with Panda AI"}
            loading={draft.isPending}
            onClick={() =>
              draft.mutate(undefined, {
                onSuccess: (rows) => toast(`${rows.length} risks drafted. Review and edit each one.`, "success"),
                onError: fail("Panda AI could not draft the register."),
              })
            }
          />
          <Button
            size="sm"
            variant="secondary"
            loading={create.isPending}
            onClick={() =>
              create.mutate(
                { title: "New risk", description: "Describe the cause and its effect on the job." },
                { onError: fail("Could not add the risk.") },
              )
            }
          >
            + Add risk
          </Button>
        </div>
      </div>

      {isPending ? (
        <div className="flex justify-center py-10">
          <Spinner size="sm" />
        </div>
      ) : isError ? (
        <p className="px-4 py-6 text-sm text-red-600">{getApiErrorMessage(error, "Could not load the register.")}</p>
      ) : risks.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-gray-500">
          No risks yet. Draft a register with Panda AI or add the first one by hand.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-[minmax(0,2fr)_110px_110px_64px_minmax(0,1fr)_120px_130px_auto] gap-2 border-b border-line-hair bg-gray-50 px-4 py-2 text-xs font-medium uppercase text-ink-muted">
            {HEADERS.map((h, i) => (
              <span key={i}>{h}</span>
            ))}
          </div>
          <ul className="divide-y divide-line-hair">
            {risks.map((risk) => (
              <RiskRow
                key={risk.id}
                risk={risk}
                saving={update.isPending || confirm.isPending}
                onSave={(body) => update.mutate({ riskId: risk.id, body }, { onError: fail("Could not save the risk.") })}
                onConfirm={() =>
                  confirm.mutate(risk.id, {
                    onSuccess: () => toast("Risk confirmed.", "success"),
                    onError: fail("Could not confirm the risk."),
                  })
                }
                onDelete={() => setRemoveTarget(risk)}
              />
            ))}
          </ul>
        </>
      )}

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        variant="danger"
        title="Remove this risk?"
        description={removeTarget ? `"${removeTarget.title}" is removed from the register.` : undefined}
        confirmLabel="Remove"
        loading={remove.isPending}
        onConfirm={() => {
          if (!removeTarget) return;
          remove.mutate(removeTarget.id, {
            onSuccess: () => setRemoveTarget(null),
            onError: fail("Could not remove the risk."),
          });
        }}
      />
    </section>
  );
}
RiskRegisterTable.displayName = "RiskRegisterTable";
