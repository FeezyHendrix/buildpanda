import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { Spinner } from "@/components/atoms/spinner";
import { EmptyState } from "@/components/molecules/empty-state";
import { UploadComplianceDocDialog } from "@/components/molecules/compliance-docs/upload-compliance-doc-dialog";
import { complianceDocsApi, type ComplianceDoc } from "@/api/compliance-docs";
import { useAbility } from "@/contexts/ability-context";
import { useComplianceDocs, useDeleteComplianceDoc } from "@/hooks/use-compliance-docs";
import { getApiErrorMessage } from "@/lib/api-error";
import { COMPLIANCE_DOC_TYPE_LABEL, COMPLIANCE_STATUS_META } from "@/lib/compliance-meta";
import { formatShortDate } from "@/lib/formatters";
import { toast } from "@/lib/toast";

function expiryCopy(doc: ComplianceDoc): string {
  if (!doc.expiryDate) return "No expiry date";
  const days = doc.daysUntilExpiry ?? 0;
  if (days < 0) return `Expired ${formatShortDate(doc.expiryDate)}`;
  if (days === 0) return "Expires today";
  return `Expires ${formatShortDate(doc.expiryDate)} · ${days} day${days === 1 ? "" : "s"}`;
}

function DocRow({ doc, canManage, onRemove }: { doc: ComplianceDoc; canManage: boolean; onRemove: (doc: ComplianceDoc) => void }) {
  const status = COMPLIANCE_STATUS_META[doc.status];
  async function openFile() {
    try {
      const url = await complianceDocsApi.viewUrl(doc.id);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      toast(getApiErrorMessage(err, "Could not open the file."), "error");
    }
  }
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-gray-900">{COMPLIANCE_DOC_TYPE_LABEL[doc.docType]}</p>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <p className="mt-0.5 truncate text-xs text-gray-500">
          {doc.fileName}
          {doc.reference ? ` · ${doc.reference}` : ""}
          {` · ${expiryCopy(doc)}`}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button size="sm" variant="ghost" onClick={() => void openFile()}>Open</Button>
        {canManage ? (
          <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => onRemove(doc)}>Remove</Button>
        ) : null}
      </div>
    </li>
  );
}
DocRow.displayName = "DocRow";

export default function ComplianceDocsPage() {
  const ability = useAbility();
  const canManage = ability.can("manage", "complianceDocs");
  const { data: docs = [], isPending, isError } = useComplianceDocs();
  const remove = useDeleteComplianceDoc();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ComplianceDoc | null>(null);

  const attention = docs.filter((d) => d.status === "expiring" || d.status === "expired").length;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/sales/settings" className="text-xs font-medium text-primary-600 hover:underline">← Settings</Link>
          <h1 className="mt-1 text-xl font-semibold text-gray-900">Compliance documents</h1>
          <p className="mt-1 text-sm text-gray-500">
            Insurance, bonds, guarantees and registrations kept once for the company. Proposals and projects reference them; nothing is copied.
          </p>
        </div>
        {canManage ? <Button onClick={() => setUploadOpen(true)}>File a document</Button> : null}
      </div>

      {attention > 0 ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {attention} document{attention === 1 ? " needs" : "s need"} attention: expiring within thirty days or already expired.
        </p>
      ) : null}

      {isPending ? (
        <div className="flex justify-center py-10"><Spinner size="sm" /></div>
      ) : isError ? (
        <EmptyState variant="inline" title="Could not load compliance documents" description="Refresh the page to try again." />
      ) : docs.length === 0 ? (
        <EmptyState
          variant="inline"
          title="No compliance documents yet"
          description="Start with the all-risk insurance certificate, which building control asks for on the site board and the proposal pack shows to the client."
          action={canManage ? { label: "File a document", onClick: () => setUploadOpen(true) } : undefined}
        />
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {docs.map((doc) => (
            <DocRow key={doc.id} doc={doc} canManage={canManage} onRemove={setRemoveTarget} />
          ))}
        </ul>
      )}

      <UploadComplianceDocDialog open={uploadOpen} onOpenChange={setUploadOpen} />
      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}
        variant="danger"
        title="Remove this document?"
        description={removeTarget ? `${removeTarget.fileName} will no longer be listed. Proposals that referenced it lose the link.` : undefined}
        confirmLabel="Remove"
        loading={remove.isPending}
        onConfirm={() => {
          if (!removeTarget) return;
          remove.mutate(removeTarget.id, {
            onSuccess: () => setRemoveTarget(null),
            onError: (e) => { setRemoveTarget(null); toast(getApiErrorMessage(e, "Could not remove the document."), "error"); },
          });
        }}
      />
    </div>
  );
}
