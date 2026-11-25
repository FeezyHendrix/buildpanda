import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Select } from "@/components/atoms/select";
import { CurrencyAmountField, DRAWER_FIELD_CLASS, DRAWER_LABEL_CLASS } from "@/components/molecules/drawer-fields";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { useCreateTransaction, useUpdateTransaction } from "@/hooks/use-transactions";
import { resolveFileUrl, useUploadFile } from "@/hooks/use-files";
import { errorMessage } from "@/lib/api-error";
import { currencySymbol } from "@/lib/formatters";
import { proofError } from "@/lib/photo-proof";
import { cn } from "@/lib/utils";
import type { CreateTransactionInput, Transaction, TransactionCategoryInfo } from "@/lib/project-types";
import { ExpenseFlagFields, ExpenseProofField, ExpenseReceiptField } from "./expense-form-fields";

const MANAGE_CATEGORIES = "__manage__";
const TEXTAREA_CLASS = cn(DRAWER_FIELD_CLASS, "h-[132px] resize-none py-[16px]");

interface TransactionFormValues {
  title: string;
  description: string;
  category: string;
  amount: string;
  transactedAt: string;
  vendor: string;
  reference: string;
  receiptFileId: string;
  stageId: string;
  credit: boolean;
  recoverable: boolean;
}

const EMPTY_FORM: TransactionFormValues = {
  title: "",
  description: "",
  category: "",
  amount: "",
  transactedAt: new Date().toISOString().split("T")[0]!,
  vendor: "",
  reference: "",
  receiptFileId: "",
  stageId: "",
  credit: false,
  recoverable: false,
};

function valuesOf(initial: Transaction | null | undefined): TransactionFormValues {
  if (!initial) return { ...EMPTY_FORM };
  return {
    title: initial.title,
    description: initial.description ?? "",
    category: initial.category,
    amount: initial.amount.toString(),
    transactedAt: initial.transactedAt.split("T")[0] || "",
    vendor: initial.vendor ?? "",
    reference: initial.reference ?? "",
    receiptFileId: initial.receiptFileId ?? "",
    stageId: initial.stageId ?? "",
    credit: initial.credit,
    recoverable: initial.recoverable,
  };
}

function Field({ label, htmlFor, optional, children }: { label: string; htmlFor?: string; optional?: boolean; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-[5px]">
      <label htmlFor={htmlFor} className={DRAWER_LABEL_CLASS}>
        {label}
        {optional ? <span className="font-normal text-[#737373]"> (optional)</span> : null}
      </label>
      {children}
    </div>
  );
}

Field.displayName = "Field";

interface UpsertTransactionDialogProps {
  projectId: string;
  currency: string;
  initial?: Transaction | null;
  categories: TransactionCategoryInfo[];
  onClose: () => void;
  onManageCategories: () => void;
}

/**
 * Record or edit one expense: a logged outlay with its receipt, never a payment
 * the system makes. The build stage an expense was attributed to is not on the
 * form; an edit keeps whatever the record already carries.
 *
 * Photo proof is picked and validated but not sent: the API has no field for it
 * (docs/expenses-backend.md). Credit / refund and Recoverable deposit are set
 * when the expense is recorded and are not offered on edit.
 */
export function UpsertTransactionDialog({ projectId, currency, initial, categories, onClose, onManageCategories }: UpsertTransactionDialogProps) {
  const isEdit = Boolean(initial);
  const [values, setValues] = useState<TransactionFormValues>(() => valuesOf(initial));
  const [receiptName, setReceiptName] = useState<string | null>(initial?.receiptFileId ? "Receipt attached" : null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [proof, setProof] = useState<File | null>(null);
  const [proofProblem, setProofProblem] = useState<string | null>(null);

  const create = useCreateTransaction(projectId);
  const update = useUpdateTransaction(projectId);
  const uploadFile = useUploadFile();
  const mutation = isEdit ? update : create;

  useEffect(() => {
    if (initial?.receiptFileId) {
      resolveFileUrl(initial.receiptFileId).then(setReceiptUrl).catch(() => {});
    }
  }, [initial?.receiptFileId]);

  const categoryOptions = useMemo(
    () => [...categories.map((c) => ({ value: c.key, label: c.label })), { value: MANAGE_CATEGORIES, label: "+ New category…" }],
    [categories],
  );

  function patch(next: Partial<TransactionFormValues>): void {
    setValues((prev) => ({ ...prev, ...next }));
  }

  async function handleReceipt(files: FileList): Promise<void> {
    const file = files[0];
    if (!file) return;
    setUploadProgress(0);
    try {
      const res = await uploadFile.mutateAsync({ file, projectId, onProgress: setUploadProgress });
      patch({ receiptFileId: res.id });
      setReceiptName(file.name);
      setReceiptUrl(await resolveFileUrl(res.id));
    } catch (err) {
      console.error(err);
    } finally {
      setUploadProgress(null);
    }
  }

  function handleProof(files: FileList): void {
    const file = files[0];
    if (!file) return;
    const problem = proofError(file);
    setProofProblem(problem);
    setProof(problem ? null : file);
  }

  function handleSubmit(): void {
    const payload: CreateTransactionInput = {
      title: values.title,
      description: values.description || null,
      category: values.category,
      amount: Number(values.amount),
      transactedAt: values.transactedAt,
      vendor: values.vendor || null,
      reference: values.reference || null,
      receiptFileId: values.receiptFileId || null,
      stageId: values.stageId || null,
      credit: values.credit,
      recoverable: values.recoverable,
    };
    if (isEdit && initial) {
      update.mutate({ transactionId: initial.id, body: payload }, { onSuccess: onClose });
    } else {
      create.mutate(payload, { onSuccess: onClose });
    }
  }

  // An expense is an outlay, so a negative figure is never what the user
  // means — money coming back is a credit, which is a flag on the record, not
  // a minus sign the mask would swallow anyway. The API refuses it too.
  const isNegative = values.amount.trim().startsWith("-") || Number(values.amount) < 0;
  const isValid = Boolean(values.title && values.category && values.amount && values.transactedAt && !isNegative);
  const negativeMessage = isEdit
    ? "An expense cannot be negative."
    : "An expense cannot be negative — record a refund or credit note instead by turning on Credit / refund.";
  const formError = isNegative ? negativeMessage : mutation.error ? errorMessage(mutation.error) : null;

  return (
    <FormDrawer
      open
      onOpenChange={(open) => !open && onClose()}
      title={isEdit ? "Edit Expenses" : "Record Expenses"}
      submitLabel="Save Entry"
      submitting={mutation.isPending || uploadProgress !== null}
      submitDisabled={!isValid || uploadProgress !== null}
      error={formError}
      onSubmit={handleSubmit}
      footerVariant="stacked"
      className="w-[min(430px,100vw)]"
      titleClassName="text-[20px] leading-[28px] tracking-normal"
      headerClassName="px-[24px] pb-[23px] pt-[40px]"
      bodyClassName="gap-[19px] px-[24px] py-0"
      footerClassName="gap-[3px] px-[24px] pb-[17px] pt-6 [&>button]:h-[46px]"
    >
      <Field label="Title" htmlFor="expense-title">
        <input
          id="expense-title"
          className={DRAWER_FIELD_CLASS}
          value={values.title}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="e.g. Concrete mix"
        />
      </Field>

      <div className="grid grid-cols-2 gap-[16px]">
        <Field label="Amount" htmlFor="expense-amount">
          <CurrencyAmountField id="expense-amount" value={values.amount} onChange={(amount) => patch({ amount })} currency={currency} symbol={currencySymbol(currency)} />
        </Field>
        <Field label="Date" htmlFor="expense-date">
          <input id="expense-date" type="date" className={DRAWER_FIELD_CLASS} value={values.transactedAt} onChange={(e) => patch({ transactedAt: e.target.value })} />
        </Field>
      </div>

      <Field label="Category" htmlFor="expense-category">
        <Select
          id="expense-category"
          options={categoryOptions}
          value={values.category || null}
          onChange={(value) => (value === MANAGE_CATEGORIES ? onManageCategories() : value ? patch({ category: value }) : undefined)}
          placeholder="Select category"
          className="h-[45px] px-[16px] text-caption-l"
          iconClassName="text-[#A3A3A3]"
        />
      </Field>

      <div className="grid grid-cols-2 gap-[16px]">
        <Field label="Vendor" htmlFor="expense-vendor">
          <input id="expense-vendor" className={DRAWER_FIELD_CLASS} value={values.vendor} onChange={(e) => patch({ vendor: e.target.value })} placeholder="e.g. BuildMart" />
        </Field>
        <Field label="Reference / Invoice #" htmlFor="expense-reference">
          <input id="expense-reference" className={DRAWER_FIELD_CLASS} value={values.reference} onChange={(e) => patch({ reference: e.target.value })} placeholder="e.g. INV-0034" />
        </Field>
      </div>

      <Field label="Description" htmlFor="expense-description" optional>
        <textarea
          id="expense-description"
          className={TEXTAREA_CLASS}
          value={values.description}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="What was this spend for?"
        />
      </Field>

      {isEdit ? null : (
        <div className="mt-[4px]">
          <ExpenseProofField file={proof} problem={proofProblem} onFiles={handleProof} onClear={() => setProof(null)} />
        </div>
      )}

      {isEdit ? null : (
        <ExpenseFlagFields
          credit={values.credit}
          recoverable={values.recoverable}
          onCreditChange={(credit) => patch({ credit })}
          onRecoverableChange={(recoverable) => patch({ recoverable })}
        />
      )}

      <ExpenseReceiptField
        receiptName={values.receiptFileId ? receiptName : null}
        receiptUrl={receiptUrl}
        uploadProgress={uploadProgress}
        onFiles={(files) => void handleReceipt(files)}
        onClear={() => {
          patch({ receiptFileId: "" });
          setReceiptName(null);
          setReceiptUrl(null);
        }}
      />
    </FormDrawer>
  );
}

UpsertTransactionDialog.displayName = "UpsertTransactionDialog";
