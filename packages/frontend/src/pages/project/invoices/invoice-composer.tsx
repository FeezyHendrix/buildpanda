import { useEffect, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/atoms/button";
import { SHEET_HEADER_RULED, WIDE_SHEET } from "@/components/molecules/wide-sheet";
import {
  useCreateInvoice,
  useSendInvoice,
  useSetPayApplication,
  type Invoice,
  type InvoiceScanResult,
} from "@/hooks/use-invoices";
import { useOrgProfile } from "@/hooks/use-org-profile";
import { formatCurrency } from "@/lib/formatters";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { formatPeriodLabel } from "../finances/schedule-of-values-line";
import { TYPES, countValidLines, draftToInvoiceValues, sanitizeInvoice } from "./invoice-form-model";
import { toInput } from "./invoice-utils";
import { useInvoiceForm } from "./use-invoice-form";
import { useProgressInvoiceSeed } from "./use-progress-invoice-seed";
import { ComposerForm } from "./composer-form";
import { ScannedDetailsBanner } from "./scanned-details-banner";

interface InvoiceComposerProps {
  projectId: string;
  currency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the form is pre-filled from a scanned document. */
  scan?: InvoiceScanResult | null;
  /** When set (YYYY-MM), a progress invoice is seeded from the billing sheet's month. */
  period?: string | null;
}

const EMAIL_RE = /\S+@\S+\.\S+/;

/**
 * In-page invoice composer. Unlike the old /invoices/new page, this creates AND
 * sends in one action so "Send invoice" actually sends; "Save as draft" is the
 * create-only fallback. Opens over the Invoices list (context preserved) and
 * pre-fills from a scan in memory — no router-state handoff.
 */
export function InvoiceComposer({ projectId, currency, open, onOpenChange, scan, period }: InvoiceComposerProps) {
  const form = useInvoiceForm();
  const create = useCreateInvoice();
  const send = useSendInvoice();
  const setPayApplication = useSetPayApplication();
  const { data: orgProfile } = useOrgProfile();
  const seed = useProgressInvoiceSeed(projectId, open ? period : null, currency);

  const [busy, setBusy] = useState<"idle" | "draft" | "send">("idle");
  const sourceFileId = scan?.sourceFileId;

  // Seed the form once per open: from the scan draft, the billing-sheet month
  // (once its data is in), or an empty invoice.
  const seededRef = useRef(false);
  const prefilledInstructions = useRef(false);
  useEffect(() => {
    if (open && !seededRef.current && seed.ready) {
      seededRef.current = true;
      prefilledInstructions.current = false;
      form.reset(scan ? draftToInvoiceValues(scan.draft, currency) : seed.values);
    } else if (!open) {
      seededRef.current = false;
      setBusy("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scan, seed.ready]);

  // A sheet-seeded invoice also carries its pay application, so the month is
  // flagged as billed and the stage lines are on record from the start.
  function attachPayApplication(created: Invoice): Promise<unknown> {
    if (!period || seed.payLines.length === 0) return Promise.resolve();
    return setPayApplication
      .mutateAsync({ projectId, invoiceId: created.id, lines: seed.payLines, period })
      .catch((e) => toast(`Invoice saved, but the pay application was not: ${getApiErrorMessage(e)}`, "error"));
  }

  // Prefill payment instructions from the org default once it loads (stays editable).
  const orgInstructions = orgProfile?.paymentInstructions ?? "";
  useEffect(() => {
    if (!open || !orgInstructions || prefilledInstructions.current) return;
    if (form.values.paymentInstructions === "") {
      prefilledInstructions.current = true;
      form.update("paymentInstructions", orgInstructions);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orgInstructions]);

  const money = (n: number): string => formatCurrency(n, form.values.currency || currency);
  // The design keeps Trade inside More Options, so it cannot block saving: a blank one falls back to the type's name.
  const canSubmit = form.values.vendorName.trim().length > 0 && countValidLines(form.values) > 0;
  const prepared = () => {
    const clean = sanitizeInvoice(form.values);
    return { ...clean, trade: clean.trade || (TYPES.find((t) => t.value === clean.invoiceType)?.label ?? "Invoice") };
  };
  const recipient = form.values.recipientEmail.trim();
  const recipientValid = EMAIL_RE.test(recipient);
  const busySubmitting = busy !== "idle";

  function saveDraft(): void {
    if (!canSubmit || busySubmitting) return;
    setBusy("draft");
    create.mutate(
      { projectId, ...toInput(prepared()), sourceFileId },
      {
        onSuccess: async (created) => {
          await attachPayApplication(created);
          toast("Draft saved", "success");
          onOpenChange(false);
        },
        onError: (e) => toast(getApiErrorMessage(e), "error"),
        onSettled: () => setBusy("idle"),
      },
    );
  }

  function sendInvoice(): void {
    if (!canSubmit || !recipientValid || busySubmitting) return;
    setBusy("send");
    create.mutate(
      { projectId, ...toInput(prepared()), sourceFileId },
      {
        onSuccess: async (created) => {
          await attachPayApplication(created);
          send.mutate(
            { projectId, invoiceId: created.id, recipientEmail: recipient },
            {
              onSuccess: () => {
                toast(`Invoice sent to ${recipient}`, "success");
                onOpenChange(false);
              },
              onError: (e) => toast(getApiErrorMessage(e), "error"),
              onSettled: () => setBusy("idle"),
            },
          );
        },
        onError: (e) => {
          toast(getApiErrorMessage(e), "error");
          setBusy("idle");
        },
      },
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/30 transition-opacity duration-300",
            "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
          )}
        />
        <Dialog.Popup
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-[min(1026px,100vw)] flex-col bg-white shadow-drawer outline-none",
            "transition-transform duration-300 ease-out",
            "data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full",
          )}
        >
          <header className={SHEET_HEADER_RULED}>
            <Dialog.Title className={cn("font-bold text-grey-800", WIDE_SHEET.titleClassName)}>
              {period ? `Progress invoice · ${formatPeriodLabel(period)}` : "New invoice"}
            </Dialog.Title>
            <Dialog.Description className={cn("text-pretty", WIDE_SHEET.descriptionClassName)}>
              {period
                ? "Seeded from the billing sheet: each line is what a stage billed this month. Add who it's for, then send or save."
                : "Add who it's for and the line items — totals update as you type."}
            </Dialog.Description>
          </header>
          <div aria-hidden className="mx-[24px] h-px shrink-0 bg-[#EEEEEE]" />

          <div className="flex flex-1 flex-col gap-[24px] overflow-y-auto px-[24px] pb-[24px] pt-[24px] no-scrollbar">
            {scan && <ScannedDetailsBanner draft={scan.draft} currency={form.values.currency || currency} />}
            <ComposerForm form={form} money={money} projectId={projectId} />
          </div>

          <footer className="px-[24px] pb-[25px] pt-[16px]">
            {canSubmit && !recipientValid && (
              <p className="mb-2 text-right text-caption-m text-[#737373]">Add a client email to send, or save it as a draft for now.</p>
            )}
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-caption-l text-[#737373]">Net Payable</p>
                <p className="truncate text-[24px] font-medium leading-[32px] tracking-[-0.02em] tabular-nums text-[#004DE7]">{money(form.totals.netPayable)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-[4px]">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-[46px] w-[165px] whitespace-nowrap border border-[#E0E0E0] px-[16px]"
                  onClick={saveDraft}
                  disabled={!canSubmit || busySubmitting}
                  loading={busy === "draft"}
                >
                  Save as Draft
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  className="h-[46px] w-[165px] whitespace-nowrap px-[16px]"
                  onClick={sendInvoice}
                  disabled={!canSubmit || !recipientValid || busySubmitting}
                  loading={busy === "send"}
                >
                  Send Invoice
                </Button>
              </div>
            </div>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

InvoiceComposer.displayName = "InvoiceComposer";
