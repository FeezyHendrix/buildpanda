import { useEffect, useState } from "react";
import { FileImage, X } from "lucide-react";
import { CurrencyAmountField } from "@/components/molecules/drawer-fields";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { MediaDropzone } from "@/components/molecules/media-dropzone";
import { useFundProject } from "@/hooks/use-finances";
import { errorMessage } from "@/lib/api-error";
import { currencySymbol } from "@/lib/formatters";
import { PROOF_ACCEPT, proofError } from "@/lib/photo-proof";
import { toast } from "@/lib/toast";

/**
 * Records money the client has put into the project. Funding is NOT
 * certification: it never moves the contract waterfall, it sits in its own
 * ledger, and like everything else here it logs a movement that happened
 * off-platform rather than making one.
 *
 * Photo proof of the transfer is picked and validated here, but NOT yet sent:
 * the deposit endpoint takes only an amount, a description and a date, and
 * rejects any other field. Once the backend accepts `proofFileId`, upload the
 * file in `handleSubmit` and pass the id. See docs/finance-overview-backend.md.
 */
const LABEL_CLASS = "text-caption-m font-semibold text-[#1E1E1E]";

interface RecordDepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  currency: string;
}

export function RecordDepositDialog({ open, onOpenChange, projectId, currency }: RecordDepositDialogProps) {
  const fund = useFundProject();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [proofProblem, setProofProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setDescription("");
    setProof(null);
    setProofProblem(null);
    fund.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const parsed = Number(amount);
  const isValid = amount.trim().length > 0 && Number.isFinite(parsed) && parsed > 0;

  function handleSubmit(): void {
    if (!isValid) return;
    fund.mutate(
      { projectId, amount: parsed, description: description.trim() || undefined },
      {
        onSuccess: () => {
          toast("Funding recorded", "success");
          onOpenChange(false);
        },
      },
    );
  }

  function handleProof(files: FileList): void {
    const file = files[0];
    if (!file) return;
    const problem = proofError(file);
    setProofProblem(problem);
    setProof(problem ? null : file);
  }

  const symbol = currencySymbol(currency);

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Record funding"
      description="Money the client has put into the project. This is funding, not certification — it does not change what has been certified or paid on the contract."
      submitLabel="Record Funding"
      submitDisabled={!isValid}
      submitting={fund.isPending}
      error={fund.error ? errorMessage(fund.error) : null}
      onSubmit={handleSubmit}
      footerVariant="stacked"
      className="w-[min(430px,100vw)]"
      titleClassName="text-[20px] leading-[28px] tracking-normal"
      headerClassName="px-[24px] pb-[22px] pt-[40px]"
      bodyClassName="gap-[19px] px-[24px] py-0"
      footerClassName="gap-[3px] px-[24px] pb-[17px] pt-6 [&>button]:h-[46px]"
    >
      <div className="flex flex-col gap-[5px]">
        <label htmlFor="deposit-amount" className={LABEL_CLASS}>Amount</label>
        <CurrencyAmountField id="deposit-amount" value={amount} onChange={setAmount} currency={currency} symbol={symbol} autoFocus />
      </div>

      <div className="flex flex-col gap-[5px]">
        <label htmlFor="deposit-description" className={LABEL_CLASS}>What this covers</label>
        <input
          id="deposit-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Valuation"
          maxLength={200}
          className="h-[45px] w-full border border-[#EEEEEE] bg-white px-[16px] text-caption-l text-[#1E1E1E] outline-none placeholder:text-[#B0B0B0] focus:border-[#004DE7]"
        />
      </div>

      <div className="flex flex-col gap-[5px]">
        <span className={LABEL_CLASS}>
          Photo proof <span className="font-normal text-[#737373]">(optional)</span>
        </span>
        <MediaDropzone
          accept={PROOF_ACCEPT}
          multiple={false}
          hint="JPG or PNG, max 10MB"
          onFiles={handleProof}
          height={120}
          className="rounded-none border-[#EEEEEE]"
        >
          {proof ? (
            <div className="flex w-full items-center gap-[10px] px-[16px]" onClick={(event) => event.stopPropagation()}>
              <FileImage className="size-[18px] shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-caption-l text-[#1E1E1E]">{proof.name}</span>
              <button
                type="button"
                aria-label="Remove photo proof"
                onClick={() => setProof(null)}
                className="shrink-0 text-[#737373] hover:text-[#1E1E1E]"
              >
                <X className="size-[16px]" aria-hidden />
              </button>
            </div>
          ) : undefined}
        </MediaDropzone>
        {proofProblem ? <p className="text-caption-m text-error-600">{proofProblem}</p> : null}
      </div>
    </FormDrawer>
  );
}

RecordDepositDialog.displayName = "RecordDepositDialog";
