import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { DetailDrawer } from "../finance-drawer";
import { Tabs } from "@/components/molecules/tabs";
import type { Invoice } from "@/hooks/use-invoices";
import type { Currency } from "@/lib/project-types";
import type { InvoiceAction } from "./invoice-action-dialogs";
import { InvoiceDetailsPanel, InvoiceLineItemsPanel, InvoicePaymentsPanel } from "./invoice-drawer-panels";
import { invoiceLabel } from "./invoice-model";
import { InvoiceStatusSelect } from "./invoice-status-select";

/**
 * One invoice, read in place: Details | Line items | Payments. The status pill
 * in the header is the same inline control as the table row.
 */

type DrawerTab = "details" | "line-items" | "payments";

const TABS = [
  { id: "details", label: "Details" },
  { id: "line-items", label: "Line items" },
  { id: "payments", label: "Payments" },
] as const satisfies readonly { id: DrawerTab; label: string }[];

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

  if (!invoice) return null;
  const invoiceCurrency = invoice.currency || currency;

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
          <InvoiceStatusSelect projectId={projectId} invoice={invoice} disabled={!canManage} />
          <span className="text-sm text-ink-muted">{invoice.trade}</span>
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
          {canManage ? (
            <Button variant="secondary" size="sm" onClick={() => onAction(invoice, "send")}>
              Send
            </Button>
          ) : null}
          {canManage ? (
            <Button size="sm" onClick={() => onAction(invoice, "edit")}>
              Edit
            </Button>
          ) : null}
        </>
      }
    >
      <Tabs items={TABS} value={tab} onChange={setTab} ariaLabel="Invoice sections" className="-mt-2" />
      {tab === "details" ? (
        <InvoiceDetailsPanel projectId={projectId} invoice={invoice} currency={invoiceCurrency} canManage={canManage} />
      ) : null}
      {tab === "line-items" ? <InvoiceLineItemsPanel invoice={invoice} currency={invoiceCurrency} /> : null}
      {tab === "payments" ? (
        <InvoicePaymentsPanel projectId={projectId} invoice={invoice} currency={invoiceCurrency} canManage={canRecordPayment} />
      ) : null}
    </DetailDrawer>
  );
}

InvoiceDrawer.displayName = "InvoiceDrawer";
