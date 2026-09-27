import { useEffect, useState } from "react";
import { INPUT_CLASS } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { MoneyInput } from "@/components/atoms/money-input";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { CONTRACT_STATUSES, type Contract, type ContractStatus } from "@/api/contracts";
import { useCreateContract, useUpdateContract } from "@/hooks/use-contracts";
import { getApiErrorMessage } from "@/lib/api-error";
import { currencySymbol, formatCurrency } from "@/lib/formatters";
import { toast } from "@/lib/toast";
import { CONTRACT_KIND_LABEL, CONTRACT_STATUS_META, SIGNED_NEEDS_DOCUMENT } from "./contract-model";

/**
 * Create + edit in one drawer; `initial` decides the mode. A new contract is
 * always a change-order contract (the main one is derived from the contract
 * terms); its total is set once here. Editing records the particulars — the
 * document is attached from the contract drawer, and Signed needs it.
 */

interface UpsertContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  currency: string;
  initial: Contract | null;
}

export function UpsertContractDialog({ open, onOpenChange, projectId, currency, initial }: UpsertContractDialogProps) {
  const isEdit = initial !== null;
  const create = useCreateContract();
  const update = useUpdateContract();
  const mutation = isEdit ? update : create;

  const [title, setTitle] = useState("");
  const [trade, setTrade] = useState("");
  const [legalEntity, setLegalEntity] = useState("");
  const [total, setTotal] = useState("");
  const [status, setStatus] = useState<ContractStatus>("Draft");
  const [signedAt, setSignedAt] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setTrade(initial?.trade ?? "");
    setLegalEntity(initial?.legalEntity ?? "");
    setTotal("");
    setStatus(initial?.status ?? "Draft");
    setSignedAt(initial?.signedAt?.slice(0, 10) ?? "");
    create.reset();
    update.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id]);

  const parsedTotal = Number(total);
  const totalValid = total.trim() === "" || (Number.isFinite(parsedTotal) && parsedTotal >= 0);
  const isValid = title.trim().length > 0 && totalValid;
  const hasDocument = Boolean(initial?.documentId);

  function handleSubmit(): void {
    if (!isValid) return;
    const done = () => {
      toast(isEdit ? "Contract updated" : "Contract added", "success");
      onOpenChange(false);
    };
    if (isEdit && initial) {
      if (status === "Signed" && !hasDocument) {
        toast(SIGNED_NEEDS_DOCUMENT, "error");
        return;
      }
      update.mutate(
        {
          projectId,
          contractId: initial.id,
          title: title.trim(),
          trade: trade.trim() || null,
          legalEntity: legalEntity.trim() || null,
          status,
          signedAt: signedAt || null,
        },
        { onSuccess: done },
      );
      return;
    }
    create.mutate(
      {
        projectId,
        title: title.trim(),
        trade: trade.trim() || null,
        legalEntity: legalEntity.trim() || null,
        ...(total.trim() === "" ? {} : { total: parsedTotal }),
      },
      { onSuccess: done },
    );
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit contract" : "Add contract"}
      description={
        isEdit
          ? `${CONTRACT_KIND_LABEL[initial.kind]} · total ${formatCurrency(initial.total, currency)}. Attach the signed document from the contract drawer.`
          : "A change-order contract. Its total is recorded once; the main contract is priced by the contract sum in Terms."
      }
      submitLabel={isEdit ? "Save changes" : "Add contract"}
      submitDisabled={!isValid}
      submitting={mutation.isPending}
      error={mutation.error ? getApiErrorMessage(mutation.error) : null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contract-title">Contract ID</Label>
        <input
          id="contract-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. CO-003 Electrical rework"
          maxLength={200}
          className={INPUT_CLASS}
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contract-trade">Trade</Label>
          <input id="contract-trade" value={trade} onChange={(event) => setTrade(event.target.value)} placeholder="e.g. Electrical" className={INPUT_CLASS} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contract-entity">Legal entity</Label>
          <input id="contract-entity" value={legalEntity} onChange={(event) => setLegalEntity(event.target.value)} placeholder="Contracting entity" className={INPUT_CLASS} />
        </div>
      </div>

      {isEdit ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contract-status">Status</Label>
            <select
              id="contract-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as ContractStatus)}
              className={INPUT_CLASS}
              title={hasDocument ? undefined : SIGNED_NEEDS_DOCUMENT}
            >
              {CONTRACT_STATUSES.map((option) => (
                <option key={option} value={option} disabled={option === "Signed" && !hasDocument}>
                  {CONTRACT_STATUS_META[option].label}
                  {option === "Signed" && !hasDocument ? " (attach document first)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contract-signed">Signed date</Label>
            <input id="contract-signed" type="date" value={signedAt} onChange={(event) => setSignedAt(event.target.value)} className={INPUT_CLASS} />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contract-total">Total</Label>
          <MoneyInput id="contract-total" value={total} onChange={setTotal} currencySymbol={currencySymbol(currency)} />
          <p className="text-xs text-ink-muted">Leave blank to price it from the change order later.</p>
        </div>
      )}
    </FormDrawer>
  );
}

UpsertContractDialog.displayName = "UpsertContractDialog";
