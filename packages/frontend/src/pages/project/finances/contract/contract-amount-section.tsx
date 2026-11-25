import { Button } from "@/components/atoms/button";
import { MoneyInput } from "@/components/atoms/money-input";
import { currencySymbol as symbolFor, formatCurrency } from "@/lib/formatters";
import type { ProjectFinances } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import type { ContractTermsForm } from "./contract-terms-model";
import { FIELD_CLASS, TERMS_HINT_CLASS, TermsLabel, TermsSection } from "./contract-terms-fields";

/**
 * The contract sum, the adjusted figure it implies, and the way to record an
 * approved change to it. Saving the sum is part of the Terms form; a variation
 * is its own audited entry and never edits the sum directly.
 */

interface ContractAmountSectionProps {
  form: ContractTermsForm;
  onSumChange: (value: string) => void;
  disabled: boolean;
  finances: ProjectFinances;
  canManage: boolean;
  onRecordVariation: () => void;
}

function variationTone(total: number): string {
  if (total > 0) return "text-[#00A63E]";
  if (total < 0) return "text-[#E7000B]";
  return "text-[#1E1E1E]";
}

export function ContractAmountSection({
  form,
  onSumChange,
  disabled,
  finances,
  canManage,
  onRecordVariation,
}: ContractAmountSectionProps) {
  const adjustedPreview = (Number(form.contractSum) || 0) + finances.variationsTotal;

  return (
    <TermsSection
      title="Contract amount"
      description="The base amount agreed with the contractor before changes. Revised contract = contract amount + changes."
    >
      <div className="flex flex-col gap-[20px]">
        <div className="flex flex-col gap-[6px]">
          <TermsLabel htmlFor="contract-sum">Contract Sum</TermsLabel>
          <MoneyInput
            id="contract-sum"
            value={form.contractSum}
            onChange={onSumChange}
            currencySymbol={symbolFor(finances.currency)}
            disabled={disabled}
            className="h-[44px] rounded-none border border-[#EEEEEE] bg-white pl-[30px] text-left text-caption-l text-[#1E1E1E] focus-visible:ring-0 lg:text-caption-l"
          />
          <p className={TERMS_HINT_CLASS}>
            Currently <span className="tabular-nums">{formatCurrency(finances.contractSum, finances.currency)}</span>. Variations
            recorded so far:{" "}
            <span className={cn("font-medium tabular-nums", variationTone(finances.variationsTotal))}>
              {finances.variationsTotal >= 0 ? "+" : "−"}
              {formatCurrency(Math.abs(finances.variationsTotal), finances.currency)}
            </span>
            .
          </p>
        </div>

        <div className="flex flex-col gap-[6px]">
          <TermsLabel>Adjusted contract (Live)</TermsLabel>
          <output
            aria-label="Adjusted contract, live preview"
            className={cn(FIELD_CLASS, "flex items-center font-medium tabular-nums text-[#004DE7]")}
          >
            {formatCurrency(adjustedPreview, finances.currency)}
          </output>
          <p className={TERMS_HINT_CLASS}>Preview based on the value in the field above. Save to apply.</p>
        </div>

        {canManage ? (
          <div>
            <p className="text-caption-l font-medium text-[#1E1E1E]">Approved change to the contract value?</p>
            <p className="mt-[2px] text-caption-m text-[#737373]">
              Record it as a variation — positive for additional works, negative for omissions. Every entry is kept in the audit trail.
            </p>
            <Button type="button" variant="secondary" size="sm" className="mt-[12px] rounded-none" onClick={onRecordVariation}>
              Record Variation
            </Button>
          </div>
        ) : null}
      </div>
    </TermsSection>
  );
}

ContractAmountSection.displayName = "ContractAmountSection";
