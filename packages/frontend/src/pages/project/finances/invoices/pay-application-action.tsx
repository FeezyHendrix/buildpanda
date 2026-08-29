import { useState } from "react";
import { Button } from "@/components/atoms/button";
import type { Invoice } from "@/hooks/use-invoices";
import type { Currency } from "@/lib/project-types";
import { PayApplicationDrawer } from "./pay-application-drawer";

/**
 * Opens the AIA G702/G703 sheet for a progress invoice. Only a progress
 * invoice bills stages by period, so the action renders nothing on the other
 * invoice types. Viewers can open it read-only; `canManage` gates the edits.
 */

interface PayApplicationActionProps {
  projectId: string;
  invoice: Invoice;
  currency: Currency;
  canManage: boolean;
}

export function PayApplicationAction({
  projectId,
  invoice,
  currency,
  canManage,
}: PayApplicationActionProps) {
  const [open, setOpen] = useState(false);

  if (invoice.invoiceType !== "progress") return null;

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Pay application
      </Button>

      <PayApplicationDrawer
        open={open}
        onOpenChange={setOpen}
        projectId={projectId}
        invoiceId={invoice.id}
        invoiceLabel={
          invoice.number
            ? `${invoice.vendorName} · ${invoice.number}`
            : invoice.vendorName
        }
        currency={currency}
        canManage={canManage}
      />
    </>
  );
}

PayApplicationAction.displayName = "PayApplicationAction";
