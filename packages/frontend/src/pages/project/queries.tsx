import { useState } from "react";
import { MessageCircleQuestion } from "lucide-react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { Spinner } from "@/components/atoms/spinner";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { PageHeader } from "@/components/molecules/page-header";
import { FilterTabs, VIEW_MODE_ITEMS } from "@/components/molecules/filter-tabs";
import { EmptyState } from "@/components/molecules/empty-state";
import {
  UpsertQueryDialog,
  type UpsertQueryValues,
} from "@/components/molecules/upsert-query-dialog";
import {
  QueryDetailDialog,
  QUERY_STATUS_META,
} from "@/components/molecules/query-detail-dialog";
import { KanbanBoard } from "@/components/molecules/kanban-board";
import {
  QUERY_COLUMNS,
  dueMeta,
  assigneeFooter,
} from "@/components/molecules/kanban-configs";
import { useProjectContext } from "@/layouts/project-layout";
import { useParticipants } from "@/hooks/use-participants";
import {
  useCreateQuery,
  useDeleteQuery,
  useProjectQueries,
  useUpdateQuery,
} from "@/hooks/use-queries";
import { formatDayMonth } from "@/lib/formatters";
import { canResourceAction } from "@/lib/project-types";
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
  const canDeleteQueries = canResourceAction(access, "queries", "manage");
  const canAssignQueries = canResourceAction(access, "queries", "raise");
  const [filter, setFilter] = useState<QueryStatus | "all">("all");
  const [view, setView] = useState<"list" | "board">("list");
  const { data: queries = [], isLoading } = useProjectQueries(
    project.id,
    filter === "all" ? undefined : filter,
  );
  const createQuery = useCreateQuery();
  const updateQuery = useUpdateQuery();
  const deleteQuery = useDeleteQuery();

  const { data: participants = [] } = useParticipants(project.id, canAssignQueries);
  const assigneeOptions = participants
    .filter((p) => p.userId)
    .map((p) => ({ id: p.userId as string, name: p.name ?? p.email }));

  function handleMove(query: SiteQuery, status: QueryStatus): void {
    if (query.status === status) return;
    updateQuery.mutate({ projectId: project.id, queryId: query.id, status });
  }

  function handleAssign(query: SiteQuery, assigneeId: string | null): void {
    updateQuery.mutate({
      projectId: project.id,
      queryId: query.id,
      assigneeId,
    });
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
        questionHtml: values.questionHtml,
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
    <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
      <PageHeader
        title="Queries"
        actions={
          canRaiseQueries ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => setCreateOpen(true)}
            >
              <PlusIcon className="size-4" />
              Raise query
            </Button>
          ) : undefined
        }
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <FilterTabs items={FILTERS} value={filter} onChange={setFilter} ariaLabel="Filter queries" />
        <div className="flex items-center gap-3">
          <FilterTabs items={VIEW_MODE_ITEMS} value={view} onChange={setView} ariaLabel="View" />
          <p className="text-xs text-gray-500">{openCount} open</p>
        </div>
      </div>

      {view === "board" ? (
        <div className="mt-5">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner size="md" />
            </div>
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
              assigneeOptions={canAssignQueries ? assigneeOptions : undefined}
              getAssigneeId={canAssignQueries ? (q) => q.assigneeId : undefined}
              onAssign={canAssignQueries ? handleAssign : undefined}
            />
          )}
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner size="md" />
            </div>
          ) : queries.length === 0 ? (
            <EmptyState
              icon={<MessageCircleQuestion />}
              title="No queries yet"
              description="Raise a query when you need a clarification."
            />
          ) : (
            queries.map((q) => (
              <Card
                key={q.id}
                padding="md"
                interactive
                className="flex items-center gap-4"
              >
                <button
                  type="button"
                  onClick={() => setDetailId(q.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {q.subject}
                    </p>
                    <Badge tone={QUERY_STATUS_META[q.status].tone} size="sm">
                      {QUERY_STATUS_META[q.status].label}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    {formatDue(q.dueDate) && (
                      <span>Needed by {formatDue(q.dueDate)}</span>
                    )}
                    {q.commentCount > 0 && (
                      <span>
                        {q.commentCount} comment
                        {q.commentCount === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                </button>
                {(canRaiseQueries || canDeleteQueries) && (
                  <div className="flex items-center gap-3">
                    {canRaiseQueries && (
                      <button
                        type="button"
                        onClick={() => setEditQuery(q)}
                        className="text-xs font-medium text-gray-500 hover:text-gray-900"
                      >
                        Edit
                      </button>
                    )}
                    {canDeleteQueries && (
                      <button
                        type="button"
                        onClick={() => setDeleteId(q.id)}
                        className="text-xs font-medium text-red-500 hover:text-red-600"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      )}

      <UpsertQueryDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        projectId={project.id}
        mode="create"
        assigneeOptions={canAssignQueries ? assigneeOptions : []}
        onSubmit={handleCreate}
        isSubmitting={createQuery.isPending}
        error={(createQuery.error as Error | undefined)?.message ?? null}
      />

      <UpsertQueryDialog
        open={editQuery !== null}
        onOpenChange={(o) => !o && setEditQuery(null)}
        projectId={project.id}
        mode="edit"
        assigneeOptions={canAssignQueries ? assigneeOptions : []}
        initial={
          editQuery
            ? {
                subject: editQuery.subject,
                question: editQuery.question,
                questionHtml: editQuery.questionHtml,
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
          if (deleteId)
            deleteQuery.mutate({ projectId: project.id, queryId: deleteId });
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
