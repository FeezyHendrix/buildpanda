import { useState } from "react";
import { Badge, type BadgeTone } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyRow,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/atoms/table";
import { EmptyState } from "@/components/molecules/empty-state";
import { UpsertRiskDialog, type UpsertRiskValues } from "@/components/molecules/upsert-risk-dialog";
import { useCreateRiskFactor, useDeleteRiskFactor, useEditRiskFactor } from "@/hooks/use-risks";
import type { RiskFactor } from "@/lib/project-types";

const COLUMN_COUNT = 3;

const RISK_SEVERITY_TONE: Record<RiskFactor["severity"], BadgeTone> = {
  Low: "success",
  Medium: "warning",
  High: "danger",
};

interface RiskFactorsPanelProps {
  projectId: string;
  risks: RiskFactor[];
  /** The page opens the create dialog from the tab-bar action. */
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}

/** The identified risk factors as a table: title and description, a severity pill, row actions. */
export function RiskFactorsPanel({ projectId, risks, createOpen, onCreateOpenChange }: RiskFactorsPanelProps) {
  const createRisk = useCreateRiskFactor();

  function handleCreate(values: UpsertRiskValues): void {
    createRisk.mutate({ projectId, ...values }, { onSuccess: () => onCreateOpenChange(false) });
  }

  return (
    <>
      <Table bleed>
        <TableHead>
          <tr>
            <TableHeaderCell>Risk</TableHeaderCell>
            <TableHeaderCell>Severity</TableHeaderCell>
            <TableHeaderCell align="right">
              <span className="sr-only">Actions</span>
            </TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {risks.length === 0 ? (
            <TableEmptyRow colSpan={COLUMN_COUNT}>
              <EmptyState
                variant="inline"
                title="No active risks yet"
                description="Add a risk factor to track and mitigate issues on this project."
                action={{ label: "Add risk", onClick: () => onCreateOpenChange(true) }}
              />
            </TableEmptyRow>
          ) : (
            risks.map((risk) => <RiskFactorRow key={risk.id} projectId={projectId} risk={risk} />)
          )}
        </TableBody>
      </Table>

      <UpsertRiskDialog
        open={createOpen}
        onOpenChange={onCreateOpenChange}
        mode="create"
        onSubmit={handleCreate}
        isSubmitting={createRisk.isPending}
        error={(createRisk.error as Error | undefined)?.message ?? null}
      />
    </>
  );
}

RiskFactorsPanel.displayName = "RiskFactorsPanel";

function RiskFactorRow({ projectId, risk }: { projectId: string; risk: RiskFactor }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const editRisk = useEditRiskFactor();
  const deleteRisk = useDeleteRiskFactor();

  function handleEdit(values: UpsertRiskValues): void {
    editRisk.mutate({ projectId, riskId: risk.id, ...values }, { onSuccess: () => setEditOpen(false) });
  }

  function handleDelete(): void {
    deleteRisk.mutate({ projectId, riskId: risk.id }, { onSettled: () => setDeleteOpen(false) });
  }

  return (
    <TableRow>
      <TableCell className="max-w-xl">
        <p className="font-medium">{risk.title}</p>
        {risk.description ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{risk.description}</p>
        ) : null}
      </TableCell>
      <TableCell>
        <Badge tone={RISK_SEVERITY_TONE[risk.severity]} dot>
          {risk.severity}
        </Badge>
      </TableCell>
      <TableCell align="right">
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
            Delete
          </Button>
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
          loading={deleteRisk.isPending}
          title="Delete risk factor"
          description="This permanently removes the risk factor. This action cannot be undone."
          confirmLabel="Delete"
          variant="danger"
        />
      </TableCell>
    </TableRow>
  );
}

RiskFactorRow.displayName = "RiskFactorRow";
