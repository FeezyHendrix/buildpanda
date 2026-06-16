import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { PageHeader } from "@/components/molecules/page-header";
import { UpsertRfiDialog, type UpsertRfiValues } from "@/components/molecules/upsert-rfi-dialog";
import { RfiDetailDialog, RFI_STATUS_META } from "@/components/molecules/rfi-detail-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import { useCreateRfi, useProjectRfis } from "@/hooks/use-rfis";
import { useParticipants } from "@/hooks/use-participants";
import { cn } from "@/lib/utils";
import { formatDayMonth } from "@/lib/formatters";
import type { Rfi, RfiStatus } from "@/lib/project-types";

const FILTERS: { value: RfiStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "Open", label: "Open" },
  { value: "Answered", label: "Answered" },
  { value: "Closed", label: "Closed" },
];

function RfiRow({ rfi, onOpen }: { rfi: Rfi; onOpen: (id: string) => void }) {
  return (
    <Card
      className="cursor-pointer p-4 transition-shadow hover:shadow-sm"
      onClick={() => onOpen(rfi.id)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-400">RFI-{rfi.number}</span>
            <Badge tone={RFI_STATUS_META[rfi.status].tone} size="sm">
              {RFI_STATUS_META[rfi.status].label}
            </Badge>
            {rfi.priority === "High" && <Badge tone="danger" size="sm">High</Badge>}
            {rfi.changeRequestId && <Badge tone="accent" size="sm">Change event</Badge>}
          </div>
          <p className="mt-1.5 truncate text-sm font-medium text-gray-900">{rfi.subject}</p>
          <p className="mt-0.5 line-clamp-1 text-sm text-gray-500">{rfi.question}</p>
        </div>
        <div className="shrink-0 text-right">
          {rfi.ballInCourtName && (
            <p className="text-xs text-gray-500">{rfi.ballInCourtName}</p>
          )}
          {rfi.dueDate && (
            <p className="mt-0.5 text-xs text-gray-400">Due {formatDayMonth(rfi.dueDate)}</p>
          )}
          {rfi.commentCount > 0 && (
            <p className="mt-0.5 text-xs text-gray-400">{rfi.commentCount} response(s)</p>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function ProjectRfis() {
  const { project, access } = useProjectContext();
  const canManage = access?.capabilities?.canManage ?? false;
  const canRaise = access?.capabilities?.canRaiseQueries ?? canManage;
  const canRespond = canManage || (access?.relationship === "architect");

  const [filter, setFilter] = useState<RfiStatus | "all">("all");
  const { data: rfis = [], isLoading } = useProjectRfis(
    project.id,
    filter === "all" ? undefined : filter,
  );
  const createRfi = useCreateRfi();

  const { data: participants = [] } = useParticipants(project.id);
  const assigneeOptions = participants
    .filter((p) => p.userId)
    .map((p) => ({ id: p.userId as string, name: p.name ?? p.email }));

  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const openCount = rfis.filter((r) => r.status === "Open" || r.status === "InReview").length;

  function handleCreate(values: UpsertRfiValues): void {
    createRfi.mutate(
      { projectId: project.id, ...values },
      { onSuccess: () => setCreateOpen(false) },
    );
  }

  return (
    <div className="w-full px-6 py-8 sm:px-10">
      <PageHeader
        title="RFIs"
        description="Requests for Information: formal, numbered questions with a ball-in-court owner and an official response."
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
        <div className="inline-flex rounded-lg border border-[#EDEDED] bg-[#F6F6F6] p-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                filter === f.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-900",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {openCount > 0 && (
          <span className="text-sm text-gray-500">{openCount} awaiting response</span>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-gray-400">Loading…</p>
        ) : rfis.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="text-sm text-gray-500">No RFIs yet.</p>
            {canRaise && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => setCreateOpen(true)}
              >
                Raise the first RFI
              </Button>
            )}
          </Card>
        ) : (
          rfis.map((rfi) => <RfiRow key={rfi.id} rfi={rfi} onOpen={setDetailId} />)
        )}
      </div>

      <UpsertRfiDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        isSubmitting={createRfi.isPending}
        error={createRfi.error instanceof Error ? createRfi.error.message : null}
        assigneeOptions={assigneeOptions}
      />

      <RfiDetailDialog
        open={detailId !== null}
        onOpenChange={(open) => !open && setDetailId(null)}
        projectId={project.id}
        rfiId={detailId}
        canManage={canManage}
        canRespond={canRespond}
      />
    </div>
  );
}
