import { useState, useMemo } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { PageHeader } from "@/components/molecules/page-header";
import {
  UpsertPermitDialog,
  type UpsertPermitValues,
} from "@/components/molecules/upsert-permit-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useCreatePermit,
  useDeletePermit,
  usePermits,
  useUpdatePermit,
} from "@/hooks/use-permits";
import { formatShortDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { canResourceAction, type Permit, type PermitStatus, type PermitUrgency } from "@/lib/project-types";

const STATUS_META: Record<
  PermitStatus,
  { label: string; tone: "neutral" | "info" | "success" | "danger" | "warning" }
> = {
  NotStarted: { label: "Not started", tone: "neutral" },
  Applied: { label: "Applied", tone: "info" },
  Approved: { label: "Approved", tone: "success" },
  Rejected: { label: "Rejected", tone: "danger" },
  Expired: { label: "Expired", tone: "warning" },
};

function getExpiryLabel(permit: Permit): { text: string; tone: "danger" | "warning" | "success" | "neutral" } {
  switch (permit.urgency) {
    case "expired":
      return {
        text: permit.daysUntilExpiry === 0 ? "Expires today" : `Expired ${Math.abs(permit.daysUntilExpiry!)} day(s) ago`,
        tone: "danger",
      };
    case "expiringSoon":
      return {
        text: `Expires in ${permit.daysUntilExpiry} day(s)`,
        tone: "warning",
      };
    case "active":
      return {
        text: `Valid until ${formatShortDate(permit.expiryDate)}`,
        tone: "success",
      };
    case "none":
    default:
      return { text: "No expiry date", tone: "neutral" };
  }
}

function PermitCard({
  permit,
  canManage,
  onEdit,
  onDelete,
}: {
  permit: Permit;
  canManage: boolean;
  onEdit: (permit: Permit) => void;
  onDelete: (id: string) => void;
}) {
  const expiry = getExpiryLabel(permit);
  const statusMeta = STATUS_META[permit.status] || STATUS_META.NotStarted;

  const accentColor = 
    expiry.tone === "danger" ? "border-l-red-500" :
    expiry.tone === "warning" ? "border-l-amber-500" :
    expiry.tone === "success" ? "border-l-green-500" :
    "border-l-gray-300";

  return (
    <Card className={cn("overflow-hidden border-l-4", accentColor)}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between p-4 gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-gray-900">{permit.title}</span>
            <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
          </div>
          
          <div className="text-sm text-gray-500 flex items-center gap-2">
            {permit.authority ? <span>{permit.authority}</span> : <span>Unknown authority</span>}
            {permit.referenceNo && (
              <>
                <span>·</span>
                <span>Ref {permit.referenceNo}</span>
              </>
            )}
          </div>

          <div className={cn(
            "text-sm font-medium",
            expiry.tone === "danger" ? "text-red-600" :
            expiry.tone === "warning" ? "text-amber-600" :
            expiry.tone === "success" ? "text-green-600" :
            "text-gray-500"
          )}>
            {expiry.text}
          </div>
        </div>
        
        {canManage && (
          <div className="flex items-center gap-2 self-start">
            <Button variant="ghost" onClick={() => onEdit(permit)}>
              Edit
            </Button>
            <Button variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => onDelete(permit.id)}>
              Delete
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function ProjectPermits() {
  const { project, access } = useProjectContext();
  const canManage = Boolean(access && canResourceAction(access, "permits", "manage"));
  const { data: permits = [], isLoading } = usePermits(project.id);
  const createPermit = useCreatePermit();
  const updatePermit = useUpdatePermit();
  const deletePermit = useDeletePermit();

  const [createOpen, setCreateOpen] = useState(false);
  const [editPermit, setEditPermit] = useState<Permit | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterUrgency, setFilterUrgency] = useState<PermitUrgency | "all">("all");

  function handleCreate(values: UpsertPermitValues): void {
    createPermit.mutate(
      { projectId: project.id, ...values },
      { onSuccess: () => setCreateOpen(false) },
    );
  }
  function handleEdit(values: UpsertPermitValues): void {
    if (!editPermit) return;
    updatePermit.mutate(
      { projectId: project.id, permitId: editPermit.id, ...values },
      { onSuccess: () => setEditPermit(null) },
    );
  }

  const counts = useMemo(() => {
    return {
      expired: permits.filter(p => p.urgency === "expired").length,
      expiringSoon: permits.filter(p => p.urgency === "expiringSoon").length,
      active: permits.filter(p => p.urgency === "active").length,
    };
  }, [permits]);

  const filteredPermits = useMemo(() => {
    if (filterUrgency === "all") return permits;
    return permits.filter(p => p.urgency === filterUrgency);
  }, [permits, filterUrgency]);

  // Mutually exclusive groups: every permit lands in exactly one, so a permit is
  // never double-rendered (a future-dated NotStarted permit is "active" urgency,
  // not "other").
  const needsAttention = filteredPermits.filter(p => p.urgency === "expired" || p.urgency === "expiringSoon");
  const active = filteredPermits.filter(p => p.urgency === "active");
  const other = filteredPermits.filter(p => p.urgency === "none");

  return (
    <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
      <PageHeader
        title="Permits & Compliance"
        description="Regulatory permits and government approvals — track applications, references, and expiry."
        actions={
          canManage ? (
            <Button
              variant="primary"
              onClick={() => setCreateOpen(true)}
            >
              Add permit
            </Button>
          ) : null
        }
      />

      {!isLoading && permits.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-8">
          <button
            onClick={() => setFilterUrgency("all")}
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium transition-colors",
              filterUrgency === "all" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            All
          </button>
          
          {counts.expired > 0 && (
            <button
              onClick={() => setFilterUrgency(filterUrgency === "expired" ? "all" : "expired")}
              className={cn(
                "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                filterUrgency === "expired" ? "bg-red-600 text-white" : "bg-red-50 text-red-700 hover:bg-red-100"
              )}
            >
              <span className="mr-1.5 inline-block w-2 h-2 rounded-full bg-current opacity-75"></span>
              {counts.expired} expired
            </button>
          )}

          {counts.expiringSoon > 0 && (
            <button
              onClick={() => setFilterUrgency(filterUrgency === "expiringSoon" ? "all" : "expiringSoon")}
              className={cn(
                "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                filterUrgency === "expiringSoon" ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-700 hover:bg-amber-100"
              )}
            >
              <span className="mr-1.5 inline-block w-2 h-2 rounded-full bg-current opacity-75"></span>
              {counts.expiringSoon} expiring soon
            </button>
          )}

          {counts.active > 0 && (
            <button
              onClick={() => setFilterUrgency(filterUrgency === "active" ? "all" : "active")}
              className={cn(
                "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                filterUrgency === "active" ? "bg-green-600 text-white" : "bg-green-50 text-green-700 hover:bg-green-100"
              )}
            >
              <span className="mr-1.5 inline-block w-2 h-2 rounded-full bg-current opacity-75"></span>
              {counts.active} active
            </button>
          )}

          {counts.expired === 0 && counts.expiringSoon === 0 && counts.active > 0 && filterUrgency === "all" && (
            <span className="text-sm font-medium text-green-700 bg-green-50 px-3 py-1 rounded-full flex items-center">
              <span className="mr-1.5 inline-block w-2 h-2 rounded-full bg-current opacity-75"></span>
              All permits are current
            </span>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="mt-8">Loading permits...</div>
      ) : permits.length === 0 ? (
        <Card className="p-8 text-center mt-8">
          <h3 className="text-lg font-medium text-gray-900">No permits yet</h3>
          <p className="mt-2 text-gray-500">Add building permits and government approvals to track them.</p>
          {canManage && (
            <Button variant="primary" className="mt-4" onClick={() => setCreateOpen(true)}>
              Add permit
            </Button>
          )}
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          {needsAttention.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                Needs attention
                <Badge tone="neutral">{needsAttention.length}</Badge>
              </h3>
              <div className="flex flex-col gap-3">
                {needsAttention.map((p) => (
                  <PermitCard key={p.id} permit={p} canManage={canManage} onEdit={setEditPermit} onDelete={setDeleteId} />
                ))}
              </div>
            </section>
          )}

          {active.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                Active
                <Badge tone="neutral">{active.length}</Badge>
              </h3>
              <div className="flex flex-col gap-3">
                {active.map((p) => (
                  <PermitCard key={p.id} permit={p} canManage={canManage} onEdit={setEditPermit} onDelete={setDeleteId} />
                ))}
              </div>
            </section>
          )}

          {other.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                Other
                <Badge tone="neutral">{other.length}</Badge>
              </h3>
              <div className="flex flex-col gap-3">
                {other.map((p) => (
                  <PermitCard key={p.id} permit={p} canManage={canManage} onEdit={setEditPermit} onDelete={setDeleteId} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {createOpen && (
        <UpsertPermitDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          mode="create"
          onSubmit={handleCreate}
          isSubmitting={createPermit.isPending}
          error={createPermit.error?.message}
        />
      )}

      {editPermit && (
        <UpsertPermitDialog
          open={Boolean(editPermit)}
          onOpenChange={(o) => !o && setEditPermit(null)}
          mode="edit"
          initial={editPermit}
          onSubmit={handleEdit}
          isSubmitting={updatePermit.isPending}
          error={updatePermit.error?.message}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete permit"
        description="Are you sure you want to delete this permit? This action cannot be undone."
        variant="danger"
        confirmLabel="Delete"
        loading={deletePermit.isPending}
        onConfirm={() => deleteId && deletePermit.mutate({ projectId: project.id, permitId: deleteId }, { onSuccess: () => setDeleteId(null) })}
      />
    </div>
  );
}
