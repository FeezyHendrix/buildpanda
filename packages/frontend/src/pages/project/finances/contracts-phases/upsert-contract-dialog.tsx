import { useEffect, useState } from "react";
import { Select } from "@/components/atoms/select";
import { CurrencyAmountField, DRAWER_FIELD_CLASS, DRAWER_LABEL_CLASS } from "@/components/molecules/drawer-fields";
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

  const statusOptions = CONTRACT_STATUSES.filter((option) => option !== "Signed" || hasDocument || status === "Signed").map(
    (option) => ({ value: option, label: CONTRACT_STATUS_META[option].label }),
  );

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
      submitLabel={isEdit ? "Save Changes" : "Add Contract"}
      submitDisabled={!isValid}
      submitting={mutation.isPending}
      error={mutation.error ? getApiErrorMessage(mutation.error) : null}
      onSubmit={handleSubmit}
      footerVariant="stacked"
      className="w-[min(430px,100vw)]"
      titleClassName="text-[20px] leading-[28px] tracking-normal"
      headerClassName="px-[24px] pb-[22px] pt-[40px]"
      bodyClassName="gap-[19px] px-[24px] py-0"
      footerClassName="gap-[3px] px-[24px] pb-[17px] pt-6 [&>button]:h-[46px]"
    >
      <div className="flex flex-col gap-[5px]">
        <label htmlFor="contract-title" className={DRAWER_LABEL_CLASS}>Contract ID</label>
        <input
          id="contract-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. CO-003 Electrical work"
          maxLength={200}
          className={DRAWER_FIELD_CLASS}
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-[24px]">
        <div className="flex flex-col gap-[5px]">
          <label htmlFor="contract-trade" className={DRAWER_LABEL_CLASS}>Trade</label>
          <input id="contract-trade" value={trade} onChange={(event) => setTrade(event.target.value)} placeholder="e.g. Electrical" className={DRAWER_FIELD_CLASS} />
        </div>
        <div className="flex flex-col gap-[5px]">
          <label htmlFor="contract-entity" className={DRAWER_LABEL_CLASS}>Legal entity</label>
          <input id="contract-entity" value={legalEntity} onChange={(event) => setLegalEntity(event.target.value)} placeholder="Contracting entity" className={DRAWER_FIELD_CLASS} />
        </div>
      </div>

      {isEdit ? (
        <>
          <div className="grid grid-cols-2 gap-[24px]">
            <div className="flex flex-col gap-[5px]">
              <label htmlFor="contract-status" className={DRAWER_LABEL_CLASS}>Status</label>
              <Select
                id="contract-status"
                options={statusOptions}
                value={status}
                onChange={(next) => setStatus((next ?? "Draft") as ContractStatus)}
                className="h-[45px] px-[16px]"
              />
            </div>
            <div className="flex flex-col gap-[5px]">
              <label htmlFor="contract-signed" className={DRAWER_LABEL_CLASS}>Signed date</label>
              <input id="contract-signed" type="date" value={signedAt} onChange={(event) => setSignedAt(event.target.value)} className={DRAWER_FIELD_CLASS} />
            </div>
          </div>
          {hasDocument ? null : <p className="-mt-[10px] text-caption-m text-[#737373]">{SIGNED_NEEDS_DOCUMENT}.</p>}
        </>
      ) : (
        <div className="flex flex-col gap-[5px]">
          <label htmlFor="contract-total" className={DRAWER_LABEL_CLASS}>Total</label>
          <CurrencyAmountField id="contract-total" value={total} onChange={setTotal} currency={currency} symbol={currencySymbol(currency)} />
          <p className="text-caption-m text-[#737373]">Leave blank to price it from the change order later.</p>
        </div>
      )}
    </FormDrawer>
  );
}

UpsertContractDialog.displayName = "UpsertContractDialog";
