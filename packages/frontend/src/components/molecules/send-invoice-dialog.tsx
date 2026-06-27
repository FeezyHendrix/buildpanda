import { useEffect, useState } from "react";
import { FormDrawer } from "./form-drawer";
import { Label } from "@/components/atoms/label";
import { cn } from "@/lib/utils";

export interface SendInvoiceValues {
  recipientEmail: string;
  cc: string[];
  bcc: string[];
  coverNote: string;
}

interface SendInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultRecipient?: string | null;
  onSubmit: (values: SendInvoiceValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

const inputClass =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10";

function parseEmails(raw: string): string[] {
  return raw
    .split(/[,\s]+/)
    .map((e) => e.trim())
    .filter((e) => e.length > 0);
}

function SendInvoiceDialog({
  open,
  onOpenChange,
  defaultRecipient,
  onSubmit,
  isSubmitting = false,
  error,
}: SendInvoiceDialogProps) {
  const [recipient, setRecipient] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [coverNote, setCoverNote] = useState("");

  useEffect(() => {
    if (open) {
      setRecipient(defaultRecipient ?? "");
      setCc("");
      setBcc("");
      setCoverNote("");
    }
  }, [open, defaultRecipient]);

  const isValid = /\S+@\S+\.\S+/.test(recipient.trim());

  function handleSubmit(): void {
    if (!isValid) return;
    onSubmit({
      recipientEmail: recipient.trim(),
      cc: parseEmails(cc),
      bcc: parseEmails(bcc),
      coverNote: coverNote.trim(),
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Send invoice"
      description="Email the invoice PDF to your client. Add CC and BCC recipients and an optional cover note."
      submitLabel="Send invoice"
      submitDisabled={!isValid}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="send-to">Recipient email</Label>
        <input
          id="send-to"
          type="email"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="client@example.com"
          autoFocus
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="send-cc">CC</Label>
          <input
            id="send-cc"
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            placeholder="pm@example.com, qs@example.com"
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="send-bcc">BCC</Label>
          <input
            id="send-bcc"
            value={bcc}
            onChange={(e) => setBcc(e.target.value)}
            placeholder="records@example.com"
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="send-cover">Cover note</Label>
        <textarea
          id="send-cover"
          value={coverNote}
          onChange={(e) => setCoverNote(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Please find attached our invoice for works completed…"
          className={cn(inputClass, "h-auto py-2")}
        />
      </div>
    </FormDrawer>
  );
}

SendInvoiceDialog.displayName = "SendInvoiceDialog";

export { SendInvoiceDialog };
