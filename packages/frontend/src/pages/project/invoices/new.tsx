import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Breadcrumbs } from "@/components/molecules/breadcrumbs";
import { Button } from "@/components/atoms/button";
import { BackArrowIcon } from "@/components/atoms/project-nav-icons";
import { useProjectContext } from "@/layouts/project-layout";
import { useCreateInvoice, type InvoiceScanResult, type ExtractedInvoice } from "@/hooks/use-invoices";
import { useOrgProfile } from "@/hooks/use-org-profile";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "@/lib/toast";
import { toInput } from "./invoice-utils";
import { EMPTY_INVOICE, sanitizeInvoice, draftToInvoiceValues } from "./invoice-form-model";
import { useInvoiceForm } from "./use-invoice-form";
import { InvoiceForm } from "./invoice-form";
import { TotalsCard } from "./invoice-totals-card";
import { cn } from "@/lib/utils";
import { DocumentsIcon, AlertIcon, CheckIcon } from "@/components/atoms/project-nav-icons";

export default function NewInvoicePage() {
  const { project } = useProjectContext();
  const navigate = useNavigate();
  const createInvoice = useCreateInvoice();
  const listPath = `/project/${project.id}/finances/invoices`;

  const location = useLocation();
  const scanState = location.state as { scan?: InvoiceScanResult } | null;
  const scanResult = scanState?.scan;
  const sourceFileId = useRef(scanResult?.sourceFileId ?? undefined).current;

  const initialValues = useRef(
    scanResult
      ? draftToInvoiceValues(scanResult.draft, project.currency)
      : { ...EMPTY_INVOICE, currency: project.currency }
  ).current;

  const form = useInvoiceForm(initialValues);

  // Prefill payment instructions from the org default once it loads;
  // the field stays editable per invoice after that.
  const { data: orgProfile } = useOrgProfile();
  const prefilledInstructions = useRef(false);
  const orgInstructions = orgProfile?.paymentInstructions ?? "";
  useEffect(() => {
    if (!orgInstructions || prefilledInstructions.current) return;
    prefilledInstructions.current = true;
    if (form.values.paymentInstructions === "") {
      form.update("paymentInstructions", orgInstructions);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgInstructions]);

  const money = (n: number): string =>
    formatCurrency(n, form.values.currency || project.currency);
  const error = (createInvoice.error as Error | undefined)?.message ?? null;

  function cancel(): void {
    navigate(listPath);
  }

  function handleSubmit(): void {
    if (!form.isValid || createInvoice.isPending) return;
    createInvoice.mutate(
      { projectId: project.id, ...toInput(sanitizeInvoice(form.values)), sourceFileId },
      {
        onSuccess: () => {
          toast("Invoice created", "success");
          navigate(listPath);
        },
      },
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      className="w-full px-4 pb-32 pt-8 sm:px-10 lg:px-6 lg:pb-12"
    >
      <Breadcrumbs
        items={[
          { label: "Finances", to: `/project/${project.id}/finances` },
          { label: "Invoices", to: listPath },
          { label: "New invoice" },
        ]}
        className="mb-4"
      />

      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={cancel}
          aria-label="Back to invoices"
          className="mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#F6F6F6] text-gray-600 hover:bg-gray-200"
        >
          <BackArrowIcon className="size-4" />
        </button>
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-tight text-black-900 text-balance">
            New invoice
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] text-black-300 text-pretty">
            Build a construction invoice with line items, VAT, WHT and
            retention. The totals update as you type.
          </p>
        </div>
      </div>

      {scanResult && (
        <ScannedDetailsBanner draft={scanResult.draft} currency={form.values.currency || project.currency} />
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        <InvoiceForm form={form} money={money} />

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <TotalsCard
            values={form.values}
            totals={form.totals}
            money={money}
            isValid={form.isValid}
            submitting={createInvoice.isPending}
            error={error}
            validLineCount={form.validLineCount}
            onCancel={cancel}
          />
        </aside>
      </div>

      <MobileActionBar
        isValid={form.isValid}
        submitting={createInvoice.isPending}
        onCancel={cancel}
        netPayable={money(form.totals.netPayable)}
      />
    </form>
  );
}

interface MobileActionBarProps {
  isValid: boolean;
  submitting: boolean;
  onCancel: () => void;
  netPayable: string;
}

function MobileActionBar({
  isValid,
  submitting,
  onCancel,
  netPayable,
}: MobileActionBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#F0F0F0] bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/80 lg:hidden">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            Net payable
          </p>
          <p className="truncate text-sm font-bold tabular-nums text-primary-700">
            {netPayable}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" size="md" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={!isValid}
            loading={submitting}
          >
            Create
          </Button>
        </div>
      </div>
    </div>
  );
}

function ScannedDetailsBanner({ draft, currency }: { draft: ExtractedInvoice; currency: string }) {
  const isWarning = draft.documentKind !== "invoice" || draft.confidence === "low";
  
  return (
    <div className={cn("mt-6 rounded-xl border p-4", isWarning ? "border-amber-200 bg-amber-50" : "border-[#E4E9F5] bg-[#F5F8FF]")}>
      <div className="flex gap-3">
        {isWarning ? (
          <AlertIcon className="mt-0.5 size-5 shrink-0 text-amber-600" />
        ) : (
          <CheckIcon className="mt-0.5 size-5 shrink-0 text-[#004DE7]" />
        )}
        <div>
          <h3 className={cn("text-sm font-semibold", isWarning ? "text-amber-900" : "text-[#004DE7]")}>
            {isWarning 
              ? "This document may not be a clean invoice" 
              : "Review the scanned details below and edit anything before saving."}
          </h3>
          {isWarning && (
            <p className="mt-1 max-w-3xl text-sm text-amber-700">
              The AI detected this as a {draft.documentKind} with {draft.confidence} confidence. Please check every field carefully against the original document.
            </p>
          )}
          
          <div className="mt-4 rounded-lg border border-white/40 bg-white/60 p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <DocumentsIcon className="size-4" />
              Document says
            </div>
            <div className="flex flex-wrap gap-2">
              {draft.vendorName && <Chip label="Vendor" value={draft.vendorName} />}
              {draft.invoiceNumber && <Chip label="Invoice #" value={draft.invoiceNumber} />}
              {draft.issueDate && <Chip label="Issue date" value={draft.issueDate} />}
              {draft.dueDate && <Chip label="Due date" value={draft.dueDate} />}
              {draft.currency && <Chip label="Currency" value={draft.currency} />}
              {draft.subtotal !== null && <Chip label="Subtotal" value={formatCurrency(draft.subtotal, currency)} />}
              {draft.vatAmount !== null && <Chip label="VAT" value={formatCurrency(draft.vatAmount, currency)} />}
              {draft.total !== null && <Chip label="Total" value={formatCurrency(draft.total, currency)} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex items-baseline gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-sm shadow-sm ring-1 ring-gray-900/5">
      <span className="text-gray-500">{label}:</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}
