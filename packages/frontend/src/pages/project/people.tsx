import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { PageHeader } from "@/components/molecules/page-header";
import {
  InviteHomeownerDialog,
  type InviteHomeownerValues,
} from "@/components/molecules/invite-homeowner-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useInviteParticipant,
  useParticipants,
  useRemoveParticipant,
} from "@/hooks/use-participants";
import { PARTICIPANT_STATUS_TONE as STATUS_TONE } from "@/lib/project-meta";

export default function ProjectPeople() {
  const { project, access } = useProjectContext();
  const canManage = access?.capabilities?.canManageParticipants ?? false;
  const { data: participants = [], isLoading } = useParticipants(project.id);
  const invite = useInviteParticipant();
  const remove = useRemoveParticipant();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);

  function handleInvite(values: InviteHomeownerValues): void {
    invite.mutate(
      {
        projectId: project.id,
        email: values.email,
        name: values.name || undefined,
        role: values.role,
      },
      { onSuccess: () => setInviteOpen(false) },
    );
  }

  return (
    <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
      <PageHeader
        title="People"
        description="Homeowners and stakeholders with a portal on this build. Workspace staff are managed under Team."
        actions={
          canManage ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => setInviteOpen(true)}
            >
              <PlusIcon className="size-4" />
              Invite to project
            </Button>
          ) : undefined
        }
      />

      <div className="mt-6 flex flex-col gap-3">
        {isLoading ? (
          <p className="py-10 text-center text-sm text-gray-500">Loading…</p>
        ) : participants.length === 0 ? (
          <Card padding="lg" className="text-center">
            <p className="text-sm font-medium text-gray-900">
              No one invited yet
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Invite the homeowner so they can follow progress.
            </p>
          </Card>
        ) : (
          participants.map((p) => (
            <Card key={p.id} padding="md" className="flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {p.name ?? p.email}
                  </p>
                  <Badge tone="info" size="sm">
                    {p.role}
                  </Badge>
                  <Badge tone={STATUS_TONE[p.status]} size="sm">
                    {p.status === "invited" ? "Invite sent" : p.status}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-gray-500">
                  {p.email}
                </p>
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setRemoveId(p.id)}
                  className="text-xs font-medium text-red-500 hover:text-red-600"
                >
                  Remove
                </button>
              )}
            </Card>
          ))
        )}
      </div>

      {canManage && (
        <InviteHomeownerDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          onSubmit={handleInvite}
          isSubmitting={invite.isPending}
          error={(invite.error as Error | undefined)?.message ?? null}
        />
      )}
      <ConfirmDialog
        open={removeId !== null}
        onOpenChange={(o) => !o && setRemoveId(null)}
        onConfirm={() => {
          if (removeId)
            remove.mutate({ projectId: project.id, participantId: removeId });
          setRemoveId(null);
        }}
        title="Remove access"
        description="They will immediately lose access to this project's portal."
        confirmLabel="Remove"
        variant="danger"
      />
    </div>
  );
}
