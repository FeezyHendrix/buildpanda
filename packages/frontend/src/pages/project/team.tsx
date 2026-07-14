import { useState } from "react";
import { Avatar } from "@/components/atoms/avatar";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import {
  ContractorsIcon,
  PlusIcon,
} from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { PageHeader } from "@/components/molecules/page-header";
import {
  UpsertTeamMemberDialog,
  type UpsertTeamMemberValues,
} from "@/components/molecules/upsert-team-member-dialog";
import { InviteParticipantDrawer } from "@/components/molecules/invite-participant-drawer";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useProjectTeam,
  useCreateTeamMember,
  useEditTeamMember,
  useDeleteTeamMember,
  type TeamMember,
} from "@/hooks/use-team";
import {
  useParticipants,
  useRemoveParticipant,
} from "@/hooks/use-participants";
import { cn } from "@/lib/utils";
import type { ProjectParticipant } from "@/lib/project-types";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  client: "Client",
  architect: "Architect",
  inspector: "Inspector",
  guest: "Guest",
};

function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? role;
}

// A real display name only when it is present and not just a copy of the email,
// so the card shows "name / email" and never "email / email".
function displayName(participant: ProjectParticipant): string | null {
  const name = participant.name?.trim();
  if (!name || name.toLowerCase() === participant.email.toLowerCase()) return null;
  return name;
}

export default function ProjectTeam() {
  const { project } = useProjectContext();

  const { data: participants = [] } = useParticipants(project.id);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<
    ProjectParticipant | undefined
  >();

  const { data: members = [] } = useProjectTeam(project.id);
  const [createOpen, setCreateOpen] = useState(false);
  const createMember = useCreateTeamMember();

  function openInvite() {
    setEditTarget(undefined);
    setDrawerOpen(true);
  }

  function openEdit(p: ProjectParticipant) {
    setEditTarget(p);
    setDrawerOpen(true);
  }

  function handleCreate(values: UpsertTeamMemberValues): void {
    createMember.mutate(
      { projectId: project.id, ...values },
      { onSuccess: () => setCreateOpen(false) },
    );
  }

  return (
    <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
      <PageHeader
        title="Project Team"
        description="Manage who has access to this project and the people delivering this build."
      />

      {/* Project access */}
      <section className="mt-8">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-gray-900">
            Project access
          </h2>
          <p className="text-sm text-gray-500">
            People who can view or manage this project.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#EBEBEB]">
          {participants.map((p, idx) => (
            <ParticipantRow
              key={p.id}
              projectId={project.id}
              participant={p}
              showDivider={idx < participants.length}
              onEdit={() => openEdit(p)}
            />
          ))}
          <button
            type="button"
            onClick={openInvite}
            className="group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-primary-50"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-gray-300 transition-colors group-hover:border-[#004DE7]">
              <PlusIcon className="size-3.5 text-gray-400 transition-colors group-hover:text-[#004DE7]" />
            </div>
            <span className="text-sm text-gray-400 transition-colors group-hover:text-[#004DE7]">Invite someone…</span>
          </button>
        </div>
      </section>

      <InviteParticipantDrawer
        key={editTarget ? editTarget.id : "invite"}
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setEditTarget(undefined);
        }}
        projectId={project.id}
        initial={editTarget}
      />

      {/* Contacts */}
      <section className="mt-10 border-t border-gray-200 pt-8">
        <div className="mb-4 flex lg:flex-row lg:gap-0 gap-2 flex-col items-center justify-between">
          <div className="order-2 lg:order-1">
            <h2 className="text-base font-semibold text-gray-900">Contacts</h2>
            <p className="text-sm text-gray-500">
              People delivering this build — for reference only, does not grant
              access.
            </p>
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={() => setCreateOpen(true)}
            className="self-end lg:self-start sm:self-auto order-1 lg:order-2"
          >
            <PlusIcon className="size-4" />
            Add Contact
          </Button>
        </div>

        <UpsertTeamMemberDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          mode="create"
          onSubmit={handleCreate}
          isSubmitting={createMember.isPending}
          error={(createMember.error as Error | undefined)?.message ?? null}
        />

        {members.length === 0 ? (
          <Card padding="lg">
            <EmptyState
              icon={<ContractorsIcon className="size-6" />}
              title="No contacts yet"
              description="Add the engineers, contractors and managers working on this project."
              action={
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setCreateOpen(true)}
                >
                  <PlusIcon className="size-4" />
                  Add Contact
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {members.map((member) => (
              <TeamMemberCard
                key={member.id}
                projectId={project.id}
                member={member}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ParticipantRow({
  projectId,
  participant,
  showDivider,
  onEdit,
}: {
  projectId: string;
  participant: ProjectParticipant;
  showDivider: boolean;
  onEdit: () => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const remove = useRemoveParticipant();
  const isOwner = participant.role === "owner";

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3.5",
        showDivider && "border-b border-[#F0F0F0]",
      )}
    >
      <Avatar
        name={displayName(participant) ?? participant.email}
        size="sm"
        className="shrink-0"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">
          {displayName(participant) ?? participant.email}
        </p>
        {displayName(participant) && (
          <p className="truncate text-xs text-gray-400">{participant.email}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs text-gray-500">
          {roleLabel(participant.role)}
        </span>

        {isOwner ? (
          <Badge tone="info" size="sm">
            Owner
          </Badge>
        ) : participant.status === "invited" ? (
          <Badge tone="neutral" size="sm">
            Invited
          </Badge>
        ) : null}

        {!isOwner && (
          <>
            <button
              type="button"
              onClick={onEdit}
              className="ml-1 text-xs font-medium text-gray-400 transition-colors hover:text-gray-700"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="text-xs font-medium text-red-400 transition-colors hover:text-red-600"
            >
              Remove
            </button>
          </>
        )}
      </div>

      {!isOwner && (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onConfirm={() =>
            remove.mutate(
              { projectId, participantId: participant.id },
              { onSuccess: () => setDeleteOpen(false) },
            )
          }
          loading={remove.isPending}
          title="Remove access"
          description={`Remove ${participant.name ?? participant.email}'s access to this project?`}
          confirmLabel="Remove"
          variant="danger"
        />
      )}
    </div>
  );
}

function TeamMemberCard({
  projectId,
  member,
}: {
  projectId: string;
  member: TeamMember;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const editMember = useEditTeamMember();
  const deleteMember = useDeleteTeamMember();

  function handleEdit(values: UpsertTeamMemberValues): void {
    editMember.mutate(
      { projectId, memberId: member.id, ...values },
      { onSuccess: () => setEditOpen(false) },
    );
  }

  function handleDelete(): void {
    deleteMember.mutate({ projectId, memberId: member.id });
  }

  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Avatar name={member.name} size="md" />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-gray-900">
              {member.name}
            </p>
            <p className="text-xs text-gray-500">
              {member.role}
              {member.company ? ` · ${member.company}` : ""}
            </p>
          </div>
        </div>
        <Badge
          tone={member.status === "Active" ? "success" : "neutral"}
          size="md"
          dot
        >
          {member.status}
        </Badge>
      </div>

      {member.responsibilities && (
        <p className="text-sm text-pretty text-gray-600">
          {member.responsibilities}
        </p>
      )}

      {(member.email || member.phone) && (
        <div className="flex flex-col gap-1 border-t border-[#F0F0F0] pt-3 text-xs">
          {member.email && (
            <a
              href={`mailto:${member.email}`}
              className="font-medium text-brand hover:underline"
            >
              {member.email}
            </a>
          )}
          {member.phone && (
            <a
              href={`tel:${member.phone}`}
              className="text-gray-600 hover:text-gray-900"
            >
              {member.phone}
            </a>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 border-t border-[#F0F0F0] pt-3">
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

      <UpsertTeamMemberDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initial={{
          name: member.name,
          role: member.role,
          company: member.company ?? "",
          email: member.email ?? "",
          phone: member.phone ?? "",
          responsibilities: member.responsibilities ?? "",
          status: member.status,
        }}
        onSubmit={handleEdit}
        isSubmitting={editMember.isPending}
        error={(editMember.error as Error | undefined)?.message ?? null}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        title="Remove team member"
        description="This removes the person from the project team. This action cannot be undone."
        confirmLabel="Remove"
        variant="danger"
      />
    </Card>
  );
}
