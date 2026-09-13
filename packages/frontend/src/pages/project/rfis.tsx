import { useMemo, useState } from "react";
import { MessageCircleQuestion } from "lucide-react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { PageHeader } from "@/components/molecules/page-header";
import { FilterTabs } from "@/components/molecules/filter-tabs";
import { EmptyState } from "@/components/molecules/empty-state";
import {
  UpsertRfiDialog,
  type AssigneeOption,
  type UpsertRfiValues,
} from "@/components/molecules/upsert-rfi-dialog";
import { RfiDetailDialog } from "@/components/molecules/rfi-detail-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import { useCreateRfi, useProjectRfis, useUpdateRfi } from "@/hooks/use-rfis";
import { useParticipants } from "@/hooks/use-participants";
import { useProjectTeam } from "@/hooks/use-team";
import { errorMessage } from "@/lib/api-error";
import { choiceLabel, participantChoices } from "@/lib/assignee-options";
import { isAwaitingAnswer, isRfiOverdue } from "@/lib/rfi-meta";
import { canResourceAction } from "@/lib/project-types";
import type { Rfi, RfiStatus } from "@/lib/project-types";
import { RfiRow } from "./rfis/rfi-row";

/** "overdue" is a view of the list, not a backend status, so it filters client-side. */
type RfiFilter = RfiStatus | "all" | "overdue";

const FILTERS: { value: RfiFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "Open", label: "Open" },
  { value: "overdue", label: "Overdue" },
  { value: "Answered", label: "Answered" },
  { value: "Closed", label: "Closed" },
];

export default function ProjectRfis() {
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "rfis", "manage");
  const canRaise = canResourceAction(access, "rfis", "create");
  const canRespond = canResourceAction(access, "rfis", "respond");

  const [filter, setFilter] = useState<RfiFilter>("all");
  // Overdue is derived, so the list is always fetched unfiltered for it.
  const statusParam = filter === "all" || filter === "overdue" ? undefined : filter;
  const { data: rfis = [], isLoading } = useProjectRfis(project.id, statusParam);
  const createRfi = useCreateRfi();
  const updateRfi = useUpdateRfi();

  const { data: participants = [] } = useParticipants(project.id);
  const { data: contacts = [] } = useProjectTeam(project.id);
  const assigneeOptions: AssigneeOption[] = useMemo(
    () => [
      ...participantChoices(participants).map((choice) => ({
        id: choice.userId ?? choice.key,
        name: choiceLabel(choice),
        email: choice.email,
        isUser: choice.userId !== null,
      })),
      ...contacts.map((contact) => ({
        id: contact.id,
        name: contact.company ? `${contact.name} (${contact.company})` : contact.name,
        email: contact.email,
        isUser: false,
      })),
    ],
    [participants, contacts],
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Rfi | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const visible = useMemo(
    () => (filter === "overdue" ? rfis.filter((rfi) => isRfiOverdue(rfi)) : rfis),
    [rfis, filter],
  );
  const openCount = rfis.filter(isAwaitingAnswer).length;
  const overdueCount = rfis.filter((rfi) => isRfiOverdue(rfi)).length;

  function handleCreate(values: UpsertRfiValues): void {
    createRfi.mutate({ projectId: project.id, ...values }, { onSuccess: () => setCreateOpen(false) });
  }

  function handleEdit(values: UpsertRfiValues): void {
    if (!editing) return;
    updateRfi.mutate(
      { projectId: project.id, rfiId: editing.id, ...values },
      { onSuccess: () => setEditing(null) },
    );
  }

  return (
    <div className="w-full px-4 lg:px-6 pt-4 pb-8 sm:px-10">
      <PageHeader
        title="RFIs"
        actions={
          canRaise ? (
            <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
              <PlusIcon className="size-4" />
              Raise RFI
            </Button>
          ) : undefined
        }
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <FilterTabs items={FILTERS} value={filter} onChange={setFilter} ariaLabel="Filter RFIs" />
        <div className="flex items-center gap-3">
          {overdueCount > 0 ? (
            <Badge tone="danger" size="md">
              ⚠ {overdueCount} overdue
            </Badge>
          ) : null}
          {openCount > 0 ? <span className="text-sm text-gray-500">{openCount} awaiting response</span> : null}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner size="md" />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<MessageCircleQuestion />}
            title={filter === "overdue" ? "Nothing is overdue" : "No RFIs yet"}
            description={
              filter === "overdue"
                ? "Every RFI awaiting an answer is still inside its due date."
                : "Requests for information raised against this project will appear here."
            }
            action={
              canRaise && filter !== "overdue"
                ? { label: "Raise the first RFI", onClick: () => setCreateOpen(true) }
                : undefined
            }
          />
        ) : (
          visible.map((rfi) => <RfiRow key={rfi.id} rfi={rfi} onOpen={setDetailId} />)
        )}
      </div>

      <UpsertRfiDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        projectId={project.id}
        onSubmit={handleCreate}
        isSubmitting={createRfi.isPending}
        error={createRfi.error ? errorMessage(createRfi.error) : null}
        assigneeOptions={assigneeOptions}
      />

      <UpsertRfiDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        projectId={project.id}
        initial={editing}
        onSubmit={handleEdit}
        isSubmitting={updateRfi.isPending}
        error={updateRfi.error ? errorMessage(updateRfi.error) : null}
        assigneeOptions={assigneeOptions}
      />

      <RfiDetailDialog
        open={detailId !== null}
        onOpenChange={(open) => !open && setDetailId(null)}
        projectId={project.id}
        rfiId={detailId}
        canManage={canManage}
        canRespond={canRespond}
        onEdit={
          canManage
            ? (rfiId) => {
                const target = rfis.find((rfi) => rfi.id === rfiId) ?? null;
                setDetailId(null);
                setEditing(target);
              }
            : undefined
        }
      />
    </div>
  );
}
