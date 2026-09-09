import { useState } from "react";
import { FormDialog } from "@/components/molecules/form-dialog";
import { FileUpload } from "@/components/atoms/file-upload";
import { Input } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { COMPLIANCE_DOC_TYPES, type ComplianceDocType } from "@/api/compliance-docs";
import { useCreateComplianceDoc } from "@/hooks/use-compliance-docs";
import { useUploadFile } from "@/hooks/use-files";
import { getApiErrorMessage } from "@/lib/api-error";
import { COMPLIANCE_DOC_TYPE_LABEL } from "@/lib/compliance-meta";
import { cn } from "@/lib/utils";

const selectClass = cn(
  "h-11 w-full rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900",
  "border-0 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UploadComplianceDocDialog({ open, onOpenChange }: Props) {
  const upload = useUploadFile();
  const create = useCreateComplianceDoc();
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<ComplianceDocType>("insurance_car");
  const [reference, setReference] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const busy = upload.isPending || create.isPending;

  function reset() {
    setFile(null);
    setDocType("insurance_car");
    setReference("");
    setExpiryDate("");
    setNotes("");
    setError(null);
  }

  // Two steps behind one button: the file goes through /files like every other
  // upload, then the compliance row points at it.
  async function submit() {
    if (!file) return;
    setError(null);
    try {
      const uploaded = await upload.mutateAsync({ file });
      await create.mutateAsync({
        fileId: uploaded.id,
        docType,
        reference: reference.trim() || null,
        expiryDate: expiryDate || null,
        notes: notes.trim() || null,
      });
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not file the document."));
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => { if (!next) reset(); onOpenChange(next); }}
      title="File a compliance document"
      description="Insurance, bonds, guarantees and registrations the proposal pack and projects reference. Expiry reminders go to owners and admins."
      submitLabel="File document"
      submitDisabled={!file}
      submitting={busy}
      error={error}
      onSubmit={submit}
    >
      <FileUpload
        height={140}
        accept=".pdf,.png,.jpg,.jpeg"
        hint={file ? file.name : "PDF or image of the certificate"}
        onChange={(files) => setFile(files?.[0] ?? null)}
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="compliance-type">Document type</Label>
        <select id="compliance-type" className={selectClass} value={docType} onChange={(e) => setDocType(e.target.value as ComplianceDocType)}>
          {COMPLIANCE_DOC_TYPES.map((t) => (
            <option key={t} value={t}>{COMPLIANCE_DOC_TYPE_LABEL[t]}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="compliance-ref">Reference or policy number</Label>
          <Input id="compliance-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="POL-2026-0142" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="compliance-expiry">Expiry date</Label>
          <Input id="compliance-expiry" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="compliance-notes">Notes</Label>
        <Input id="compliance-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Insurer, cover limit, broker" />
      </div>
    </FormDialog>
  );
}
UploadComplianceDocDialog.displayName = "UploadComplianceDocDialog";
