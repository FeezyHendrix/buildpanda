import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { RecordVariationDialog } from "@/components/molecules/record-variation-dialog";
import { useProjectFinances, useUpdateContractTerms } from "@/hooks/use-finances";
import { useProjectContext } from "@/layouts/project-layout";
import { getApiErrorMessage } from "@/lib/api-error";
import { CONTRACT_TYPES, canResourceAction } from "@/lib/project-types";
import { toast } from "@/lib/toast";
import { ContractAmountSection } from "../contract/contract-amount-section";
import { AdvanceSections, PaymentTermsSection, RetentionSections } from "../contract/contract-money-sections";
import {
  CONTRACT_TYPE_LABELS,
  diffToPatch,
  toForm,
  type ContractTermsForm,
} from "../contract/contract-terms-model";
import { FIELD_CLASS, RadioCard, TERMS_HINT_CLASS, TermsSection } from "../contract/contract-terms-fields";
import {
  ContractPartiesSection,
  ContractPeriodSection,
  ContractTaxSection,
} from "../contract/contract-parties-sections";

/**
 * Terms — the contract sum and the commercial terms that govern how the main
 * contract is certified, retained and paid. A section of the main contract's
 * drawer. Saving records the agreed terms; nothing here moves money.
 */
export function ContractTermsSection() {
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "finances", "manage");
  const { data: finances, isPending, isError, error } = useProjectFinances(project.id);
  const update = useUpdateContractTerms();

  const [form, setForm] = useState<ContractTermsForm | null>(null);
  const [variationOpen, setVariationOpen] = useState(false);

  useEffect(() => {
    if (finances) setForm(toForm(finances));
  }, [finances]);

  const patch = useMemo(() => {
    if (!form || !finances) return null;
    return diffToPatch(form, finances);
  }, [form, finances]);

  const dirty = patch !== null;

  function set<K extends keyof ContractTermsForm>(key: K, value: ContractTermsForm[K]): void {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function handleReset(): void {
    if (finances) setForm(toForm(finances));
  }

  function handleSave(): void {
    if (!patch || !finances) return;
    update.mutate(
      { projectId: project.id, ...patch },
      {
        onSuccess: () => toast("Contract terms saved", "success"),
        onError: (err) => toast(getApiErrorMessage(err), "error"),
      },
    );
  }

  if (isPending) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !finances || !form) {
    return (
      <p className="bg-[#F6F6F6] p-[16px] text-center text-caption-l text-[#E7000B]">
        {getApiErrorMessage(error, "Failed to load contract terms.")}
      </p>
    );
  }

  const disabled = !canManage || update.isPending;

  return (
    <section aria-label="Contract terms">
      <ContractAmountSection
        form={form}
        onSumChange={(value) => set("contractSum", value)}
        disabled={disabled}
        finances={finances}
        canManage={canManage}
        onRecordVariation={() => setVariationOpen(true)}
      />

      <TermsSection
        title="Contract type"
        description="Which pricing structure governs this contract? This affects how changes and approvals are handled."
      >
        <div role="radiogroup" aria-label="Contract type" className="grid grid-cols-1 gap-[12px] sm:grid-cols-2">
          {CONTRACT_TYPES.map((type) => (
            <RadioCard
              key={type}
              name="contract-type"
              value={type}
              checked={form.contractType === type}
              disabled={disabled}
              onChange={(v) => set("contractType", v)}
              label={CONTRACT_TYPE_LABELS[type].label}
              hint={CONTRACT_TYPE_LABELS[type].hint}
            />
          ))}
        </div>
      </TermsSection>

      <ContractPartiesSection form={form} set={set} disabled={disabled} currency={finances.currency} />
      <ContractPeriodSection form={form} set={set} disabled={disabled} currency={finances.currency} />
      <ContractTaxSection form={form} set={set} disabled={disabled} currency={finances.currency} />
      <RetentionSections form={form} set={set} disabled={disabled} currency={finances.currency} />
      <AdvanceSections form={form} set={set} disabled={disabled} currency={finances.currency} />
      <PaymentTermsSection form={form} set={set} disabled={disabled} currency={finances.currency} />

      <TermsSection
        title="Contract notes"
        description="Free-form notes about this contract — key clauses, referenced documents, agreed exclusions."
      >
        <textarea
          id="contract-notes"
          value={form.contractNotes}
          onChange={(e) => set("contractNotes", e.target.value)}
          disabled={disabled}
          rows={5}
          maxLength={2000}
          placeholder="e.g. JCT SBC/Q 2016 with amendments. Insurance clause 6.5.1 waived by side letter dated 3 Feb."
          aria-label="Contract notes"
          className={`${FIELD_CLASS} h-auto min-h-[132px] resize-y py-[12px]`}
        />
        <p className={`mt-1 ${TERMS_HINT_CLASS}`}>{form.contractNotes.trim().length}/2000</p>
      </TermsSection>

      {canManage ? (
        dirty ? (
          <div className="mt-[24px] flex items-center justify-end gap-3 border-t border-[#EEEEEE] pt-[20px]">
            <Button variant="secondary" onClick={handleReset} disabled={update.isPending}>
              Discard changes
            </Button>
            <Button onClick={handleSave} loading={update.isPending}>
              Save contract terms
            </Button>
          </div>
        ) : null
      ) : (
        <p className="mt-[24px] bg-[#F6F6F6] p-[16px] text-caption-m text-[#737373]">
          You have read-only access. Contact a finance manager to change contract terms.
        </p>
      )}

      <RecordVariationDialog
        open={variationOpen}
        onOpenChange={setVariationOpen}
        projectId={project.id}
        currency={finances.currency}
        currentAdjustedContract={finances.adjustedContract}
        currentVariationsTotal={finances.variationsTotal}
      />
    </section>
  );
}

ContractTermsSection.displayName = "ContractTermsSection";
