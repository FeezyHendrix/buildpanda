import { useState } from "react";
import { ReactSVG } from "react-svg";
import { icons } from "@/assets/icons/icons";
import { Card } from "@/components/atoms/card";
import { Badge } from "@/components/atoms/badge";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { IconBox } from "@/components/atoms/icon-box";
import { AlertIcon } from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { UpsertRiskDialog, type UpsertRiskValues } from "@/components/molecules/upsert-risk-dialog";
import { useCreateRiskFactor, useDeleteRiskFactor, useEditRiskFactor } from "@/hooks/use-risks";
import type { RiskFactor } from "@/lib/project-types";

const RISK_SEVERITY_TONE: Record<
  RiskFactor["severity"],
  "success" | "warning" | "danger"
> = {
  Low: "success",
  Medium: "warning",
  High: "danger",
};

export function RiskFactorsPanel({
  projectId,
  risks,
  className,
}: {
  projectId: string;
  risks: RiskFactor[];
  className?: string;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const createRisk = useCreateRiskFactor();

  function handleCreate(values: UpsertRiskValues): void {
    createRisk.mutate(
      { projectId, ...values },
      { onSuccess: () => setCreateOpen(false) },
    );
  }

  return (
    <Card className={className}>
      <div className="flex items-center justify-between py-3 px-5">
        <div className="flex gap-2 items-center">
          <ReactSVG src={icons.refresh} />
          <h3 className="text-[13px] font-semibold text-black-300">
            Identified Risk Factors
          </h3>
        </div>
      </div>
      <div className="bg-white rounded-[12px] h-full m-1 p-6">
        {risks.length === 0 ? (
          <EmptyState
            title="No active risks"
            description="Add a risk factor to track and mitigate issues on this project."
            className="py-6"
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {risks.map((risk) => (
              <RiskFactorRow key={risk.id} projectId={projectId} risk={risk} />
            ))}
          </ul>
        )}

      </div>

      <UpsertRiskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onSubmit={handleCreate}
        isSubmitting={createRisk.isPending}
        error={(createRisk.error as Error | undefined)?.message ?? null}
      />
    </Card>
  );
}

function RiskFactorRow({
  projectId,
  risk,
}: {
  projectId: string;
  risk: RiskFactor;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const editRisk = useEditRiskFactor();
  const deleteRisk = useDeleteRiskFactor();

  function handleEdit(values: UpsertRiskValues): void {
    editRisk.mutate(
      { projectId, riskId: risk.id, ...values },
      { onSuccess: () => setEditOpen(false) },
    );
  }

  function handleDelete(): void {
    deleteRisk.mutate({ projectId, riskId: risk.id });
  }

  return (
    <li className="flex items-start gap-3 rounded-xl border border-[#FDECEC] bg-[#FFF7F7] p-3">
      <IconBox tone="red" size="sm" icon={<AlertIcon className="size-4" />} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900">{risk.title}</p>
        <p className="mt-1 text-xs text-gray-500">{risk.description}</p>
        <div className="mt-2 flex items-center gap-3">
          <Badge tone={RISK_SEVERITY_TONE[risk.severity]} size="sm">
            {risk.severity}
          </Badge>
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="text-xs font-medium text-gray-500 hover:text-gray-900"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="text-xs font-medium text-red-500 hover:text-red-600"
          >
            Delete
          </button>
        </div>
      </div>

      <UpsertRiskDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initial={{
          title: risk.title,
          description: risk.description,
          descriptionHtml: risk.descriptionHtml,
          severity: risk.severity,
        }}
        onSubmit={handleEdit}
        isSubmitting={editRisk.isPending}
        error={(editRisk.error as Error | undefined)?.message ?? null}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        title="Delete risk factor"
        description="This permanently removes the risk factor. This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </li>
  );
}
