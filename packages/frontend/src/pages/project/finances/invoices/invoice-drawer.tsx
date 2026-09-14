import { useMemo, useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Tabs } from "@/components/molecules/tabs";
import type { Invoice } from "@/hooks/use-invoices";
import type { Currency } from "@/lib/project-types";
import { DetailDrawer } from "../finance-drawer";
import type { InvoiceAction } from "./invoice-action-dialogs";
import { InvoiceCertificatePanel } from "./invoice-certificate-panel";
import { InvoiceDetailsPanel, InvoiceLineItemsPanel, InvoicePaymentsPanel } from "./invoice-drawer-panels";
import { InvoiceHistoryPanel } from "./invoice-history-panel";
import { invoiceLabel, isVoided } from "./invoice-model";
import { InvoiceStatusSelect } from "./invoice-status-select";

/**
 * One invoice, read in place. A certificate against the contract also carries
 * its Certificate tab (previous / this / cumulative with the deductions the
 * terms produce) and its History — who moved it, when and why.
 */

type DrawerTab = "details" | "certificate" | "line-items" | "payments" | "history";

interface TabItem {
  id: DrawerTab;
  label: string;
}

const BASE_TABS: readonly TabItem[] = [
  { id: "details", label: "Details" },
  { id: "line-items", label: "Line items" },
  { id: "payments", label: "Payments" },
  { id: "history", label: "History" },
];

/** Only a certificate raised to the employer has an IPC structure to show. */
const CERTIFICATE_TYPES = new Set(["progress", "final", "variation", "advance"]);

interface InvoiceDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  invoice: Invoice | null;
  currency: Currency;
  canManage: boolean;
  /** finances:approve — who may record a payment against the invoice. */
  canRecordPayment: boolean;
  onAction: (invoice: Invoice, action: InvoiceAction) => void;
  onDownloadPdf: (invoice: Invoice) => void;
  pdfPending: boolean;
}

export function InvoiceDrawer({
  open,
  onOpenChange,
  projectId,
  invoice,
  currency,
  canManage,
  canRecordPayment,
  onAction,
  onDownloadPdf,
  pdfPending,
}: InvoiceDrawerProps) {
  const [tab, setTab] = useState<DrawerTab>("details");

  const hasCertificate = invoice !== null && CERTIFICATE_TYPES.has(invoice.invoiceType);
  const tabs = useMemo<readonly TabItem[]>(
    () =>
      hasCertificate
        ? [BASE_TABS[0]!, { id: "certificate" as const, label: "Certificate" }, ...BASE_TABS.slice(1)]
        : BASE_TABS,
    [hasCertificate],
  );

  if (!invoice) return null;
  const invoiceCurrency = invoice.currency || currency;
  const voided = isVoided(invoice);

  return (
    <DetailDrawer
      open={open}
      onOpenChange={(next) => {
        if (!next) setTab("details");
        onOpenChange(next);
      }}
      width="lg"
      title={invoiceLabel(invoice)}
      headerMeta={
        <>
          <InvoiceStatusSelect projectId={projectId} invoice={invoice} disabled={!canManage || voided} />
          <span className="text-sm text-ink-muted">{invoice.trade}</span>
          {voided ? (
            <Badge tone="danger" size="sm" dot>
              Voided
            </Badge>
          ) : null}
        </>
      }
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => onDownloadPdf(invoice)} loading={pdfPending}>
            PDF
          </Button>
          {invoice.invoiceType === "progress" ? (
            <Button variant="secondary" size="sm" onClick={() => onAction(invoice, "pay-application")}>
              Pay application
            </Button>
          ) : null}
          {canManage && !voided ? (
            <Button variant="secondary" size="sm" onClick={() => onAction(invoice, "query")}>
              Query
            </Button>
          ) : null}
          {canManage && !voided ? (
            <Button variant="secondary" size="sm" onClick={() => onAction(invoice, "send")}>
              Send
            </Button>
          ) : null}
          {canManage && !voided ? (
            <Button size="sm" onClick={() => onAction(invoice, "edit")}>
              Edit
            </Button>
          ) : null}
        </>
      }
    >
      <Tabs items={tabs} value={tab} onChange={setTab} ariaLabel="Invoice sections" className="-mt-2" />
      {voided ? (
        <p className="rounded-lg bg-negative-50 p-4 text-sm leading-6 text-negative-700">
          Voided{invoice.voidedAt ? ` on ${invoice.voidedAt.slice(0, 10)}` : ""}
          {invoice.voidReason ? `: ${invoice.voidReason}` : "."} The certificate and its receipts
          stay on file; its figures no longer count towards the contract position.
        </p>
      ) : null}
      {tab === "details" ? (
        <InvoiceDetailsPanel projectId={projectId} invoice={invoice} currency={invoiceCurrency} canManage={canRecordPayment && !voided} />
      ) : null}
      {tab === "certificate" ? (
        <InvoiceCertificatePanel projectId={projectId} invoiceId={invoice.id} currency={invoiceCurrency} />
      ) : null}
      {tab === "line-items" ? <InvoiceLineItemsPanel invoice={invoice} currency={invoiceCurrency} /> : null}
      {tab === "payments" ? (
        <InvoicePaymentsPanel
          projectId={projectId}
          invoice={invoice}
          currency={invoiceCurrency}
          canManage={canRecordPayment}
        />
      ) : null}
      {tab === "history" ? (
        <InvoiceHistoryPanel projectId={projectId} invoiceId={invoice.id} currency={invoiceCurrency} />
      ) : null}
    </DetailDrawer>
  );
}

InvoiceDrawer.displayName = "InvoiceDrawer";
