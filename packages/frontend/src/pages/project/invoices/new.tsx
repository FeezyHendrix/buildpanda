import { useNavigate } from "react-router-dom";
import { Breadcrumbs } from "@/components/molecules/breadcrumbs";
import { Button } from "@/components/atoms/button";
import { BackArrowIcon } from "@/components/atoms/project-nav-icons";
import { useProjectContext } from "@/layouts/project-layout";
import { useCreateInvoice } from "@/hooks/use-invoices";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "@/lib/toast";
import { toInput } from "./invoice-utils";
import { EMPTY_INVOICE, sanitizeInvoice } from "./invoice-form-model";
import { useInvoiceForm } from "./use-invoice-form";
import { InvoiceForm } from "./invoice-form";
import { TotalsCard } from "./invoice-totals-card";

export default function NewInvoicePage() {
  const { project } = useProjectContext();
  const navigate = useNavigate();
  const createInvoice = useCreateInvoice();
  const listPath = `/project/${project.id}/finances/invoices`;

  const form = useInvoiceForm({ ...EMPTY_INVOICE, currency: project.currency });
  const money = (n: number): string =>
    formatCurrency(n, form.values.currency || project.currency);
  const error = (createInvoice.error as Error | undefined)?.message ?? null;

  function cancel(): void {
    navigate(listPath);
  }

  function handleSubmit(): void {
    if (!form.isValid || createInvoice.isPending) return;
    createInvoice.mutate(
      { projectId: project.id, ...toInput(sanitizeInvoice(form.values)) },
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
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
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
