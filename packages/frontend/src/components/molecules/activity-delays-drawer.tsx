import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
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
import { DetailDrawer } from "./detail-drawer";
import { EmptyState } from "./empty-state";
import { RaiseDelayDialog, type RaiseDelayValues } from "./raise-delay-dialog";
import { ResolveDelayDialog, type ResolveDelayValues } from "./resolve-delay-dialog";
import type { DelayLinkOptions } from "./delay-link-fields";
import { useActivityDelays, useResolveDelay } from "@/hooks/use-activities";
import { useDelayReasons } from "@/hooks/use-delay-reasons";
import { errorMessage } from "@/lib/api-error";
import { CULPABILITY_META, workingDaysLabel } from "@/lib/delay-meta";
import { formatCurrency, formatShortDate } from "@/lib/formatters";
import type { Activity, ActivityDelay } from "@/lib/project-types";

const COLUMN_COUNT = 6;

interface ActivityDelaysDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  activity: Activity | null;
  canManage: boolean;
  links?: DelayLinkOptions;
}

function linkLabels(delay: ActivityDelay, links?: DelayLinkOptions): string[] {
  const find = (list: { id: string; label: string }[] | undefined, id: string | null) =>
    id ? (list?.find((o) => o.id === id)?.label ?? id) : null;
  return [
    find(links?.rfis, delay.linkedRfiId),
    find(links?.changeRequests, delay.linkedChangeRequestId),
    find(links?.materialOrders, delay.linkedMaterialOrderId),
  ].filter((label): label is string => Boolean(label));
}

function DelayRow({
  delay,
  links,
  canManage,
  onResolve,
  onEdit,
}: {
  delay: ActivityDelay;
  links?: DelayLinkOptions;
  canManage: boolean;
  onResolve: () => void;
  onEdit: () => void;
}) {
  const culpability = CULPABILITY_META[delay.culpability] ?? CULPABILITY_META.neutral;
  const linked = linkLabels(delay, links);
  const isOpen = delay.resolvedAt === null;

  return (
    <TableRow>
      <TableCell>
        <p className="font-medium text-ink">{delay.reasonName}</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          {formatShortDate(delay.startedAt)}
          {delay.endedAt ? ` – ${formatShortDate(delay.endedAt)}` : " – running"}
          {delay.recordedBy?.name ? ` · ${delay.recordedBy.name}` : ""}
        </p>
        {linked.length > 0 ? (
          <p className="mt-0.5 text-xs text-ink-muted">Caused by {linked.join(" · ")}</p>
        ) : null}
      </TableCell>
      <TableCell align="right" className="whitespace-nowrap tabular-nums">
        {delay.daysLost}
        {delay.appliedShiftDays > 0 ? (
          <p className="mt-0.5 text-xs text-ink-muted">{workingDaysLabel(delay.appliedShiftDays)} applied</p>
        ) : null}
      </TableCell>
      <TableCell>
        <Badge tone={culpability.tone} size="sm">
          {culpability.glyph} {culpability.short}
        </Badge>
      </TableCell>
      <TableCell>
        {delay.eotClaimable ? (
          <Badge tone="info" size="sm">
            ✓ Claimable
          </Badge>
        ) : (
          <span className="text-xs text-ink-muted">Not claimable</span>
        )}
      </TableCell>
      <TableCell align="right" className="whitespace-nowrap tabular-nums">
        {delay.costImpact > 0 ? formatCurrency(delay.costImpact, delay.currency) : "—"}
      </TableCell>
      <TableCell align="right">
        <div className="flex items-center justify-end gap-1">
          {isOpen ? (
            <Badge dot tone="warning" size="sm">
              Open
            </Badge>
          ) : (
            <Badge dot tone="success" size="sm">
              Resolved
            </Badge>
          )}
          {canManage ? (
            <>
              {isOpen ? (
                <Button type="button" variant="secondary" size="sm" onClick={onResolve}>
                  Resolve
                </Button>
              ) : null}
              <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
                Edit
              </Button>
            </>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

DelayRow.displayName = "DelayRow";

/**
 * The delay register for one activity. Every delay here has already moved the
 * programme by `appliedShiftDays`; resolving or amending one re-measures it and
 * applies only the difference, so the dates never double-count.
 */
function ActivityDelaysDrawer({
  open,
  onOpenChange,
  projectId,
  activity,
  canManage,
  links,
}: ActivityDelaysDrawerProps) {
  const { data: delays = [], isPending } = useActivityDelays(projectId, activity?.id);
  const { data: reasons = [] } = useDelayReasons();
  const amend = useResolveDelay();

  const [resolveTarget, setResolveTarget] = useState<ActivityDelay | null>(null);
  const [editTarget, setEditTarget] = useState<ActivityDelay | null>(null);

  const openCount = delays.filter((d) => d.resolvedAt === null).length;
  const totalDaysLost = delays.reduce((sum, d) => sum + d.daysLost, 0);

  function handleResolve(values: ResolveDelayValues): void {
    if (!activity || !resolveTarget) return;
    amend.mutate(
      {
        projectId,
        activityId: activity.id,
        delayId: resolveTarget.id,
        endedAt: values.endedAt,
        daysLost: values.daysLost,
        ...(values.preventionNotes ? { preventionNotes: values.preventionNotes } : {}),
      },
      { onSuccess: () => setResolveTarget(null) },
    );
  }

  function handleEdit(values: RaiseDelayValues): void {
    if (!activity || !editTarget) return;
    amend.mutate(
      {
        projectId,
        activityId: activity.id,
        delayId: editTarget.id,
        endedAt: values.endedAt,
        daysLost: values.daysLost,
        culpability: values.culpability,
        eotClaimable: values.eotClaimable,
        linkedRfiId: values.linkedRfiId,
        linkedChangeRequestId: values.linkedChangeRequestId,
        linkedMaterialOrderId: values.linkedMaterialOrderId,
        ...(values.preventionNotes ? { preventionNotes: values.preventionNotes } : {}),
      },
      { onSuccess: () => setEditTarget(null) },
    );
  }

  return (
    <>
      <DetailDrawer
        open={open}
        onOpenChange={onOpenChange}
        width="xl"
        title={`Delays on ${activity?.name ?? ""}`}
        headerMeta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge dot tone={openCount > 0 ? "warning" : "success"} size="md">
              {openCount} open
            </Badge>
            <span className="text-sm text-gray-500">
              {workingDaysLabel(totalDaysLost)} lost across {delays.length}{" "}
              {delays.length === 1 ? "delay" : "delays"}
            </span>
          </div>
        }
      >
        <Table className="min-w-[640px]">
          <TableHead>
            <tr>
              <TableHeaderCell>Delay</TableHeaderCell>
              <TableHeaderCell align="right">Days lost</TableHeaderCell>
              <TableHeaderCell>Culpability</TableHeaderCell>
              <TableHeaderCell>EOT</TableHeaderCell>
              <TableHeaderCell align="right">Cost</TableHeaderCell>
              <TableHeaderCell align="right">Status</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {isPending ? (
              <TableEmptyRow colSpan={COLUMN_COUNT}>
                <div className="flex justify-center py-10">
                  <Spinner size="md" />
                </div>
              </TableEmptyRow>
            ) : delays.length === 0 ? (
              <TableEmptyRow colSpan={COLUMN_COUNT}>
                <EmptyState
                  variant="inline"
                  title="No delays logged"
                  description="Nothing has stopped work on this activity yet."
                />
              </TableEmptyRow>
            ) : (
              delays.map((delay) => (
                <DelayRow
                  key={delay.id}
                  delay={delay}
                  links={links}
                  canManage={canManage}
                  onResolve={() => setResolveTarget(delay)}
                  onEdit={() => setEditTarget(delay)}
                />
              ))
            )}
          </TableBody>
        </Table>
        {amend.error ? (
          <p className="mt-3 text-sm text-negative-600">{errorMessage(amend.error)}</p>
        ) : null}
      </DetailDrawer>

      <ResolveDelayDialog
        open={resolveTarget !== null}
        onOpenChange={(next) => {
          if (!next) setResolveTarget(null);
        }}
        delay={resolveTarget}
        isSubmitting={amend.isPending}
        error={amend.error ? errorMessage(amend.error) : null}
        onSubmit={handleResolve}
      />

      <RaiseDelayDialog
        open={editTarget !== null}
        onOpenChange={(next) => {
          if (!next) setEditTarget(null);
        }}
        activityName={activity?.name ?? ""}
        reasons={reasons}
        initial={editTarget}
        links={links}
        isSubmitting={amend.isPending}
        error={amend.error ? errorMessage(amend.error) : null}
        onSubmit={handleEdit}
      />
    </>
  );
}

ActivityDelaysDrawer.displayName = "ActivityDelaysDrawer";

export { ActivityDelaysDrawer, type ActivityDelaysDrawerProps };
