import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { Spinner } from "@/components/atoms/spinner";
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
import { QueryError } from "@/components/molecules/query-error";
import { RowActionsMenu, type RowActionItem } from "@/components/molecules/row-actions-menu";
import { UpsertDailyLogTemplateDrawer } from "@/components/molecules/daily-log-template/upsert-daily-log-template-drawer";
import type { DailyLogTemplate } from "@/api/daily-log-templates";
import {
  useDailyLogTemplates,
  useDeleteDailyLogTemplate,
  useUpdateDailyLogTemplate,
} from "@/hooks/use-daily-log-templates";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { SettingsCard } from "./settings-tabs";

const SCOPE_LABEL = { organization: "Workspace", project: "This project" } as const;

function questionCount(template: DailyLogTemplate): number {
  return template.fields.filter((f) => f.type !== "section").length;
}

interface RowActions {
  onEdit: (t: DailyLogTemplate) => void;
  onToggleDefault: (t: DailyLogTemplate) => void;
  onRestore: (t: DailyLogTemplate) => void;
  onRemove: (t: DailyLogTemplate) => void;
}

function rowItems(template: DailyLogTemplate, actions: RowActions): RowActionItem[] {
  if (!template.active) return [{ label: "Restore", onSelect: () => actions.onRestore(template) }];
  return [
    { label: "Edit", onSelect: () => actions.onEdit(template) },
    {
      label: template.isDefault ? "Remove as default" : "Make default",
      onSelect: () => actions.onToggleDefault(template),
    },
    {
      label: template.usageCount > 0 ? "Archive" : "Delete",
      onSelect: () => actions.onRemove(template),
      tone: "danger",
    },
  ];
}

function TemplateRow({ template, canManage, actions }: { template: DailyLogTemplate; canManage: boolean; actions: RowActions }) {
  return (
    <TableRow onClick={canManage && template.active ? () => actions.onEdit(template) : undefined}>
      <TableCell>
        <p className="font-medium text-ink">{template.name}</p>
        {template.description ? <p className="text-xs text-gray-400">{template.description}</p> : null}
      </TableCell>
      <TableCell align="right" className="tabular-nums">{questionCount(template)}</TableCell>
      <TableCell>
        <Badge tone={template.scope === "organization" ? "accent" : "neutral"}>{SCOPE_LABEL[template.scope]}</Badge>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1.5">
          {template.isDefault ? <Badge tone="info" dot>Default</Badge> : null}
          {!template.active ? <Badge tone="neutral" dot>Archived</Badge> : null}
          {template.active && !template.isDefault ? <span className="text-xs text-gray-400">Available</span> : null}
        </div>
      </TableCell>
      <TableCell align="right" className="tabular-nums">{template.usageCount}</TableCell>
      <TableCell align="right">
        {canManage ? <RowActionsMenu ariaLabel={`Actions for ${template.name}`} items={rowItems(template, actions)} /> : null}
      </TableCell>
    </TableRow>
  );
}
TemplateRow.displayName = "TemplateRow";

/**
 * The site diary forms this project's team fills in. A workspace template is
 * shared by every project in the company; a project template is this job's own.
 */
export function DailyLogTab({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const { data: templates = [], isPending, error, refetch } = useDailyLogTemplates(projectId, true);
  const update = useUpdateDailyLogTemplate(projectId);
  const remove = useDeleteDailyLogTemplate(projectId);
  // A fresh key per opening remounts the drawer, so its draft starts from `editing`.
  const [drawer, setDrawer] = useState<{ key: number; editing: DailyLogTemplate | null } | null>(null);
  const [removeTarget, setRemoveTarget] = useState<DailyLogTemplate | null>(null);

  const openDrawer = (editing: DailyLogTemplate | null) => setDrawer({ key: Date.now(), editing });
  const fail = (e: unknown) => toast(getApiErrorMessage(e, "Could not update the template."), "error");

  const actions: RowActions = {
    onEdit: openDrawer,
    onToggleDefault: (t) => update.mutate({ id: t.id, isDefault: !t.isDefault }, { onError: fail }),
    onRestore: (t) => update.mutate({ id: t.id, active: true }, { onError: fail }),
    onRemove: setRemoveTarget,
  };
  const sorted = [...templates].sort((a, b) => Number(b.active) - Number(a.active));

  return (
    <SettingsCard
      title="Daily log templates"
      description="Set the form your team fills in for each day's log — sections, questions and which answers are required. Logs keep the questions they were filled against, so editing a template never changes past records."
      action={canManage ? <Button variant="primary" size="md" className="shrink-0 whitespace-nowrap" onClick={() => openDrawer(null)}>New template</Button> : undefined}
    >
      <div className="mt-5">
        {isPending ? (
          <div className="flex justify-center py-8"><Spinner size="md" /></div>
        ) : error ? (
          <QueryError error={error} retry={refetch} noun="daily log templates" />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>Template</TableHeaderCell>
                <TableHeaderCell align="right">Questions</TableHeaderCell>
                <TableHeaderCell>Shared with</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell align="right">Logs filled</TableHeaderCell>
                <TableHeaderCell align="right"><span className="sr-only">Actions</span></TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {sorted.length === 0 ? (
                <TableEmptyRow colSpan={6}>
                  <EmptyState
                    variant="inline"
                    title="No templates yet"
                    description="Logs are written free-form until you create a template for your team to fill in."
                    action={canManage ? { label: "New template", onClick: () => openDrawer(null) } : undefined}
                  />
                </TableEmptyRow>
              ) : (
                sorted.map((t) => <TemplateRow key={t.id} template={t} canManage={canManage} actions={actions} />)
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {drawer ? (
        <UpsertDailyLogTemplateDrawer
          key={drawer.key}
          projectId={projectId}
          open
          onOpenChange={(open) => { if (!open) setDrawer(null); }}
          initial={drawer.editing}
        />
      ) : null}

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}
        variant="danger"
        title={removeTarget && removeTarget.usageCount > 0 ? "Archive this template?" : "Delete this template?"}
        description={
          removeTarget && removeTarget.usageCount > 0
            ? `${removeTarget.name} has been used on ${removeTarget.usageCount} log${removeTarget.usageCount === 1 ? "" : "s"}. It will be archived: those logs stay as they are, and it can be restored later.`
            : "It has not been used on any log, so it will be removed."
        }
        confirmLabel={removeTarget && removeTarget.usageCount > 0 ? "Archive" : "Delete"}
        loading={remove.isPending}
        onConfirm={() => {
          if (!removeTarget) return;
          remove.mutate(removeTarget.id, {
            onSuccess: () => setRemoveTarget(null),
            onError: (e) => { setRemoveTarget(null); fail(e); },
          });
        }}
      />
    </SettingsCard>
  );
}

DailyLogTab.displayName = "DailyLogTab";
