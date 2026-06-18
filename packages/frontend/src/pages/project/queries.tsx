import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { PageHeader } from "@/components/molecules/page-header";
import {
  UpsertQueryDialog,
  type UpsertQueryValues,
} from "@/components/molecules/upsert-query-dialog";
import {
  QueryDetailDialog,
  QUERY_STATUS_META,
} from "@/components/molecules/query-detail-dialog";
import { KanbanBoard } from "@/components/molecules/kanban-board";
import { QUERY_COLUMNS, dueMeta, assigneeFooter } from "@/components/molecules/kanban-configs";
import { useProjectContext } from "@/layouts/project-layout";
import { useParticipants } from "@/hooks/use-participants";
import {
  useCreateQuery,
  useDeleteQuery,
  useProjectQueries,
  useUpdateQuery,
} from "@/hooks/use-queries";
import { cn } from "@/lib/utils";
import { formatDayMonth } from "@/lib/formatters";
import type { QueryStatus, SiteQuery } from "@/lib/project-types";

const FILTERS: { value: QueryStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "Open", label: "Open" },
  { value: "Answered", label: "Answered" },
  { value: "Closed", label: "Closed" },
];

function formatDue(value: string | null): string | null {
  return formatDayMonth(value) || null;
}

export default function ProjectQueries() {
  const { project, access } = useProjectContext();
  const canRaiseQueries = access?.capabilities?.canRaiseQueries ?? false;
  const [filter, setFilter] = useState<QueryStatus | "all">("all");
  const [view, setView] = useState<"list" | "board">("list");
  const { data: queries = [], isLoading } = useProjectQueries(
    project.id,
    filter === "all" ? undefined : filter,
  );
  const createQuery = useCreateQuery();
  const updateQuery = useUpdateQuery();
  const deleteQuery = useDeleteQuery();

  const { data: participants = [] } = useParticipants(project.id);
  const assigneeOptions = participants
    .filter((p) => p.userId)
    .map((p) => ({ id: p.userId as string, name: p.name ?? p.email }));

  function handleMove(query: SiteQuery, status: QueryStatus): void {
    if (query.status === status) return;
    updateQuery.mutate({ projectId: project.id, queryId: query.id, status });
  }

  function handleAssign(query: SiteQuery, assigneeId: string | null): void {
    updateQuery.mutate({ projectId: project.id, queryId: query.id, assigneeId });
  }

  const [createOpen, setCreateOpen] = useState(false);
  const [editQuery, setEditQuery] = useState<SiteQuery | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const openCount = queries.filter((q) => q.status === "Open").length;

  function handleCreate(values: UpsertQueryValues): void {
    createQuery.mutate(
      { 
        projectId: project.id, 
        subject: values.subject, 
        question: values.question, 
        dueDate: values.dueDate,
        assigneeId: values.assigneeId,
      },
      { onSuccess: () => setCreateOpen(false) },
    );
  }

  function handleEdit(values: UpsertQueryValues): void {
    if (!editQuery) return;
    updateQuery.mutate(
      { projectId: project.id, queryId: editQuery.id, ...values },
      { onSuccess: () => setEditQuery(null) },
    );
  }

  return (
    <div className="w-full px-6 py-8 sm:px-10">
      <PageHeader
        title="Queries"
        description="Site questions and clarifications between you, the builder and the design team."
        actions={canRaiseQueries ? (
          <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
            <PlusIcon className="size-4" />
            Raise query
          </Button>
        ) : undefined}
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-[#EDEDED] bg-[#F6F6F6] p-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                filter === f.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-lg border border-[#EDEDED] bg-[#F6F6F6] p-1">
            {(["list", "board"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                  view === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900",
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500">{openCount} open</p>
        </div>
      </div>

      {view === "board" ? (
        <div className="mt-5">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-gray-500">Loading…</p>
          ) : (
            <KanbanBoard
              items={queries}
              columns={QUERY_COLUMNS}
              canManage={canRaiseQueries}
              getId={(q) => q.id}
              getStatus={(q) => q.status}
              getTitle={(q) => q.subject}
              renderMeta={(q) => dueMeta(q.dueDate)}
              renderFooter={(q) => assigneeFooter(q.assigneeName, q.dueDate)}
              onMove={handleMove}
              onOpen={setDetailId}
              assigneeOptions={assigneeOptions}
              getAssigneeId={(q) => q.assigneeId}
              onAssign={handleAssign}
            />
          )}
        </div>
      ) : (
      <div className="mt-5 flex flex-col gap-3">
        {isLoading ? (
          <p className="py-10 text-center text-sm text-gray-500">Loading…</p>
        ) : queries.length === 0 ? (
          <Card padding="lg" className="text-center">
            <p className="text-sm font-medium text-gray-900">No queries</p>
            <p className="mt-1 text-sm text-gray-500">Raise a query when you need a clarification.</p>
          </Card>
        ) : (
          queries.map((q) => (
            <Card key={q.id} padding="md" interactive className="flex items-center gap-4">
              <button type="button" onClick={() => setDetailId(q.id)} className="min-w-0 flex-1 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-gray-900">{q.subject}</p>
                  <Badge tone={QUERY_STATUS_META[q.status].tone} size="sm">
                    {QUERY_STATUS_META[q.status].label}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                  {formatDue(q.dueDate) && <span>Needed by {formatDue(q.dueDate)}</span>}
                  {q.commentCount > 0 && <span>{q.commentCount} comment{q.commentCount === 1 ? "" : "s"}</span>}
                </div>
              </button>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setEditQuery(q)} className="text-xs font-medium text-gray-500 hover:text-gray-900">
                  Edit
                </button>
                <button type="button" onClick={() => setDeleteId(q.id)} className="text-xs font-medium text-red-500 hover:text-red-600">
                  Delete
                </button>
              </div>
            </Card>
          ))
        )}
      </div>
      )}

      <UpsertQueryDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        assigneeOptions={assigneeOptions}
        onSubmit={handleCreate}
        isSubmitting={createQuery.isPending}
        error={(createQuery.error as Error | undefined)?.message ?? null}
      />

      <UpsertQueryDialog
        open={editQuery !== null}
        onOpenChange={(o) => !o && setEditQuery(null)}
        mode="edit"
        assigneeOptions={assigneeOptions}
        initial={
          editQuery
            ? {
                subject: editQuery.subject,
                question: editQuery.question,
                status: editQuery.status,
                dueDate: editQuery.dueDate,
                assigneeId: editQuery.assigneeId,
              }
            : undefined
        }
        onSubmit={handleEdit}
        isSubmitting={updateQuery.isPending}
        error={(updateQuery.error as Error | undefined)?.message ?? null}
      />

      <QueryDetailDialog
        open={detailId !== null}
        onOpenChange={(o) => !o && setDetailId(null)}
        projectId={project.id}
        queryId={detailId}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deleteQuery.mutate({ projectId: project.id, queryId: deleteId });
          setDeleteId(null);
        }}
        title="Delete query"
        description="This permanently removes the query and its discussion."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
