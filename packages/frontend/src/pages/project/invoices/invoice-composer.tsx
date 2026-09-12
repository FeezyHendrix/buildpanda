import { useEffect, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/atoms/button";
import { XIcon } from "@/components/atoms/chat-icons";
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
import { draftToInvoiceValues, sanitizeInvoice } from "./invoice-form-model";
import { toInput } from "./invoice-utils";
import { useInvoiceForm } from "./use-invoice-form";
import { useProgressInvoiceSeed } from "./use-progress-invoice-seed";
import { InvoiceForm } from "./invoice-form";
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
  const recipient = form.values.recipientEmail.trim();
  const recipientValid = EMAIL_RE.test(recipient);
  const busySubmitting = busy !== "idle";

  function saveDraft(): void {
    if (!form.isValid || busySubmitting) return;
    setBusy("draft");
    create.mutate(
      { projectId, ...toInput(sanitizeInvoice(form.values)), sourceFileId },
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
    if (!form.isValid || !recipientValid || busySubmitting) return;
    setBusy("send");
    create.mutate(
      { projectId, ...toInput(sanitizeInvoice(form.values)), sourceFileId },
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
            "fixed inset-0 z-50 bg-black/30 backdrop-blur-sm transition-opacity duration-300",
            "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
          )}
        />
        <Dialog.Popup
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-[min(820px,100vw)] flex-col border-l border-line-hair bg-surface-alt shadow-drawer outline-none",
            "transition-transform duration-300 ease-out",
            "data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full",
          )}
        >
          <header className="flex items-start justify-between gap-4 border-b border-line-hair bg-white px-6 py-5">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                {period ? `Progress invoice · ${formatPeriodLabel(period)}` : "New invoice"}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-gray-500 text-pretty">
                {period
                  ? "Seeded from the billing sheet: each line is what a stage billed this month. Add who it's for, then send or save."
                  : "Add who it's for and the line items — totals update as you type."}
              </Dialog.Description>
            </div>
            <Dialog.Close
              render={
                <button
                  type="button"
                  aria-label="Close"
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-black/5 hover:text-ink"
                >
                  <XIcon className="size-4" />
                </button>
              }
            />
          </header>

          <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-6">
            {scan && <ScannedDetailsBanner draft={scan.draft} currency={form.values.currency || currency} />}
            <InvoiceForm form={form} money={money} />
          </div>

          <footer className="border-t border-line-hair bg-white px-6 py-4">
            {form.isValid && !recipientValid && (
              <p className="mb-2 text-xs text-gray-500">
                Add a client email to send, or save it as a draft for now.
              </p>
            )}
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase text-ink-muted">
                  Net payable
                </p>
                <p className="truncate text-lg font-medium tabular-nums text-primary-700">
                  {money(form.totals.netPayable)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={saveDraft}
                  disabled={!form.isValid || busySubmitting}
                  loading={busy === "draft"}
                >
                  Save as draft
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={sendInvoice}
                  disabled={!form.isValid || !recipientValid || busySubmitting}
                  loading={busy === "send"}
                >
                  Send invoice
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
