import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { Input } from "@/components/atoms/input";
import { Spinner } from "@/components/atoms/spinner";
import { EmptyState } from "@/components/molecules/empty-state";
import { JOB_PROFILE_LABEL, type ProposalTemplate } from "@/api/proposal-templates";
import { useAbility } from "@/contexts/ability-context";
import { useDeleteProposalTemplate, useProposalTemplates, useRenameProposalTemplate } from "@/hooks/use-proposal-templates";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatShortDate } from "@/lib/formatters";
import { toast } from "@/lib/toast";

function templateSummary(t: ProposalTemplate): string {
  const parts = [
    `${t.paymentSchedule.length} payment stage${t.paymentSchedule.length === 1 ? "" : "s"}`,
    `${t.packSections.length} pack section${t.packSections.length === 1 ? "" : "s"}`,
  ];
  if (t.contingencyPct > 0) parts.push(`${t.contingencyPct}% contingency`);
  if (t.taxPct > 0) parts.push(`${t.taxLabel ?? "Tax"} ${t.taxPct}%`);
  if (t.terms.retentionPct) parts.push(`${t.terms.retentionPct}% retention`);
  return parts.join(" · ");
}

function TemplateRow({ template, canManage, onDelete }: { template: ProposalTemplate; canManage: boolean; onDelete: (t: ProposalTemplate) => void }) {
  const navigate = useNavigate();
  const rename = useRenameProposalTemplate();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(template.name);

  function commit() {
    const trimmed = name.trim();
    setEditing(false);
    if (!trimmed || trimmed === template.name) { setName(template.name); return; }
    rename.mutate({ templateId: template.id, name: trimmed }, {
      onError: (e) => { setName(template.name); toast(getApiErrorMessage(e, "Could not rename the template."), "error"); },
    });
  }

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {editing ? (
            <Input
              className="h-8 max-w-xs text-sm"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setName(template.name); setEditing(false); } }}
            />
          ) : (
            <p className="truncate text-sm font-medium text-gray-900">{template.name}</p>
          )}
          <Badge tone="info">{JOB_PROFILE_LABEL[template.jobProfile]}</Badge>
        </div>
        <p className="mt-0.5 text-xs text-gray-500">{templateSummary(template)} · saved {formatShortDate(template.createdAt)}</p>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button size="sm" onClick={() => navigate(`/sales/proposals?templateId=${template.id}`)}>Start proposal</Button>
        {canManage ? (
          <>
            <Button size="sm" variant="ghost" loading={rename.isPending} onClick={() => setEditing(true)}>Rename</Button>
            <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => onDelete(template)}>Delete</Button>
          </>
        ) : null}
      </div>
    </li>
  );
}
TemplateRow.displayName = "TemplateRow";

export default function ProposalTemplatesPage() {
  const navigate = useNavigate();
  const ability = useAbility();
  const canManage = ability.can("update", "proposals");
  const { data: templates = [], isPending, isError } = useProposalTemplates();
  const remove = useDeleteProposalTemplate();
  const [deleteTarget, setDeleteTarget] = useState<ProposalTemplate | null>(null);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <Link to="/sales/settings" className="text-xs font-medium text-primary-600 hover:underline">← Settings</Link>
        <h1 className="mt-1 text-xl font-semibold text-gray-900">Proposal templates</h1>
        <p className="mt-1 text-sm text-gray-500">
          The reusable half of an offer: payment stages, terms, tax settings and pack text. Save any proposal as a template from its Overview tab, then start the next one from it.
        </p>
      </div>

      {isPending ? (
        <div className="flex justify-center py-10"><Spinner size="sm" /></div>
      ) : isError ? (
        <EmptyState variant="inline" title="Could not load templates" description="Refresh the page to try again." />
      ) : templates.length === 0 ? (
        <EmptyState
          variant="inline"
          title="No templates yet"
          description="Open a proposal whose payment stages and terms you would reuse, and choose Save as template on its Overview tab."
          action={{ label: "Go to proposals", onClick: () => navigate("/sales/proposals") }}
        />
      ) : (
        <ul className="divide-y divide-line-hair rounded-lg border border-line bg-white">
          {templates.map((t) => (
            <TemplateRow key={t.id} template={t} canManage={canManage} onDelete={setDeleteTarget} />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        variant="danger"
        title="Delete this template?"
        description={deleteTarget ? `${deleteTarget.name} will be removed. Proposals already created from it are not affected.` : undefined}
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          remove.mutate(deleteTarget.id, {
            onSuccess: () => setDeleteTarget(null),
            onError: (e) => { setDeleteTarget(null); toast(getApiErrorMessage(e, "Could not delete the template."), "error"); },
          });
        }}
      />
    </div>
  );
}
