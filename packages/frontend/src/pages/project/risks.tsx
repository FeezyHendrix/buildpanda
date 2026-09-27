import { useMemo, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { CreateButton } from "@/components/molecules/create-button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { Spinner } from "@/components/atoms/spinner";
import { EmptyState } from "@/components/molecules/empty-state";
import { FilterTabs } from "@/components/molecules/filter-tabs";
import { KpiCard } from "@/components/molecules/kpi-card";
import { PageHeader } from "@/components/molecules/page-header";
import { UpsertRiskDialog, type UpsertRiskValues } from "@/components/molecules/upsert-risk-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import { useProjectActivities } from "@/hooks/use-activities";
import {
  useCreateRiskFactor,
  useDeleteRiskFactor,
  useEditRiskFactor,
  useProjectRiskFactors,
} from "@/hooks/use-risks";
import { errorMessage } from "@/lib/api-error";
import { canResourceAction, type RiskFactor, type RiskStatus } from "@/lib/project-types";
import { toast } from "@/lib/toast";
import { RiskRow } from "./risks/risk-row";

type RiskFilter = RiskStatus | "all" | "live";

const FILTERS: { value: RiskFilter; label: string }[] = [
  { value: "live", label: "Live" },
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "mitigated", label: "Mitigated" },
  { value: "occurred", label: "Occurred" },
  { value: "closed", label: "Closed" },
];

const SEVERITY_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

function matches(risk: RiskFactor, filter: RiskFilter): boolean {
  if (filter === "all") return true;
  if (filter === "live") return risk.status === "open" || risk.status === "mitigated";
  return risk.status === filter;
}

export default function ProjectRisks() {
  const { project, access } = useProjectContext();
  const canManage = Boolean(access && canResourceAction(access, "risks", "manage"));
  const { data: risks = [], isPending } = useProjectRiskFactors(project.id);
  const { data: activities = [] } = useProjectActivities(project.id);

  const [filter, setFilter] = useState<RiskFilter>("live");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<RiskFactor | null>(null);
  const [deleting, setDeleting] = useState<RiskFactor | null>(null);

  const createRisk = useCreateRiskFactor();
  const editRisk = useEditRiskFactor();
  const deleteRisk = useDeleteRiskFactor();

  const activityNames = useMemo(
    () => new Map(activities.map((activity) => [activity.id, activity.name])),
    [activities],
  );

  const visible = useMemo(
    () =>
      [...risks]
        .filter((risk: RiskFactor) => matches(risk, filter))
        .sort(
          (a: RiskFactor, b: RiskFactor) =>
            (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3) ||
            a.title.localeCompare(b.title),
        ),
    [risks, filter],
  );

  const openHigh = risks.filter((r) => r.severity === "High" && r.status === "open").length;
  const live = risks.filter((r) => r.status === "open" || r.status === "mitigated").length;
  const occurred = risks.filter((r) => r.status === "occurred").length;

  function handleCreate(values: UpsertRiskValues): void {
    createRisk.mutate(
      { projectId: project.id, ...values },
      {
        onSuccess: () => {
          setCreateOpen(false);
          toast("Risk added to the register", "success");
        },
      },
    );
  }

  function handleEdit(values: UpsertRiskValues): void {
    if (!editing) return;
    editRisk.mutate(
      { projectId: project.id, riskId: editing.id, ...values },
      {
        onSuccess: () => {
          setEditing(null);
          toast("Risk updated", "success");
        },
      },
    );
  }

  function setStatus(risk: RiskFactor, status: RiskStatus): void {
    editRisk.mutate(
      { projectId: project.id, riskId: risk.id, status },
      { onSuccess: () => toast(`Risk marked ${status}`, "success") },
    );
  }

  return (
    <div className="w-full px-4 pt-4 pb-8 sm:px-10 lg:px-6">
      <PageHeader
        title="Risk register"
        actions={
          canManage ? (
            <CreateButton onClick={() => setCreateOpen(true)}>
              Add risk
      </CreateButton>
          ) : undefined
        }
      />

      <section className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-3">
        <KpiCard label="Live risks" value={live} helper="open or mitigated" />
        <KpiCard
          label="Open high risks"
          value={openHigh}
          tone={openHigh > 0 ? "danger" : "default"}
          helper="drives the project risk badge"
        />
        <KpiCard label="Occurred" value={occurred} helper="realised — kept as evidence" />
      </section>

      <div className="mt-6">
        <FilterTabs items={FILTERS} value={filter} onChange={setFilter} ariaLabel="Filter risks" />
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {isPending ? (
          <div className="flex justify-center py-10">
            <Spinner size="md" />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<ShieldAlert />}
            title={risks.length === 0 ? "No risks on the register" : "Nothing matches this filter"}
            description={
              risks.length === 0
                ? "A risk is something that has not happened yet but would hurt the job if it did — ground conditions, utilities, weather, supply, approvals."
                : "Try another status tab."
            }
            action={canManage && risks.length === 0 ? { label: "Add the first risk", onClick: () => setCreateOpen(true) } : undefined}
          />
        ) : (
          visible.map((risk: RiskFactor) => (
            <RiskRow
              key={risk.id}
              risk={risk}
              canManage={canManage}
              activityName={risk.linkedActivityId ? (activityNames.get(risk.linkedActivityId) ?? null) : null}
              busy={editRisk.isPending}
              onEdit={setEditing}
              onDelete={setDeleting}
              onSetStatus={setStatus}
            />
          ))
        )}
      </div>

      {editRisk.error ? (
        <p className="mt-3 rounded-lg bg-negative-50 px-3 py-2 text-xs text-negative-600">
          {errorMessage(editRisk.error)}
        </p>
      ) : null}

      <UpsertRiskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        projectId={project.id}
        onSubmit={handleCreate}
        isSubmitting={createRisk.isPending}
        error={createRisk.error ? errorMessage(createRisk.error) : null}
      />

      <UpsertRiskDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        mode="edit"
        projectId={project.id}
        initial={editing}
        onSubmit={handleEdit}
        isSubmitting={editRisk.isPending}
        error={editRisk.error ? errorMessage(editRisk.error) : null}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        variant="danger"
        title={`Delete ${deleting?.title ?? "this risk"}?`}
        description="A risk that happened should be marked Occurred, not deleted — deleting removes the record a dispute would rely on. This cannot be undone."
        confirmLabel="Delete anyway"
        loading={deleteRisk.isPending}
        onConfirm={() => {
          if (!deleting) return;
          deleteRisk.mutate(
            { projectId: project.id, riskId: deleting.id },
            { onSuccess: () => setDeleting(null) },
          );
        }}
      />
    </div>
  );
}
