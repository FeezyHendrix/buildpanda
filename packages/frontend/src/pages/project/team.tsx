import { useState } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "@/components/atoms/avatar";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import {
  ContractorsIcon,
  PlusIcon,
  BackArrowIcon,
} from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { PageHeader } from "@/components/molecules/page-header";
import {
  UpsertTeamMemberDialog,
  type UpsertTeamMemberValues,
} from "@/components/molecules/upsert-team-member-dialog";
import {
  InviteHomeownerDialog,
  type InviteHomeownerValues,
} from "@/components/molecules/invite-homeowner-dialog";
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
  useInviteParticipant,
  useRemoveParticipant,
} from "@/hooks/use-participants";
import type { ProjectParticipant } from "@/lib/project-types";

export default function ProjectTeam() {
  const { project } = useProjectContext();
  
  const { data: participants = [] } = useParticipants(project.id);
  const [inviteOpen, setInviteOpen] = useState(false);
  const inviteParticipant = useInviteParticipant();

  function handleInvite(values: InviteHomeownerValues): void {
    inviteParticipant.mutate(
      { projectId: project.id, ...values },
      { onSuccess: () => setInviteOpen(false) }
    );
  }

  const { data: members = [] } = useProjectTeam(project.id);
  const [createOpen, setCreateOpen] = useState(false);
  const createMember = useCreateTeamMember();

  function handleCreate(values: UpsertTeamMemberValues): void {
    createMember.mutate(
      { projectId: project.id, ...values },
      { onSuccess: () => setCreateOpen(false) }
    );
  }

  return (
    <div className="w-full px-6 py-8 sm:px-10">
      <div className="mb-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900"
        >
          <BackArrowIcon className="size-4" />
          Back to projects
        </Link>
      </div>

      <PageHeader
        title="Project Team"
        description="Manage who has access to this project and list the people delivering this build."
      />

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Project access</h2>
            <p className="text-sm text-gray-500">People with access to view or manage this project.</p>
          </div>
          <Button variant="primary" size="md" onClick={() => setInviteOpen(true)}>
            <PlusIcon className="size-4" />
            Invite to project
          </Button>
        </div>

        <InviteHomeownerDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          onSubmit={handleInvite}
          isSubmitting={inviteParticipant.isPending}
          error={(inviteParticipant.error as Error | undefined)?.message ?? null}
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {participants.map((p) => (
            <ParticipantCard key={p.id} projectId={project.id} participant={p} />
          ))}
        </div>
      </section>

      <section className="mt-12 border-t border-gray-200 pt-10">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Contacts</h2>
            <p className="text-sm text-gray-500">
              People delivering this build (for reference, does not grant access).
            </p>
          </div>
          <Button variant="secondary" size="md" onClick={() => setCreateOpen(true)}>
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
              description="Add the engineers, contractors, and managers working on this project to keep everyone aligned."
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

const ROLE_LABEL = {
  owner: "Owner",
  client: "Client",
  architect: "Architect",
  inspector: "Inspector",
  guest: "Guest",
} as const;

function roleLabel(role: ProjectParticipant["role"]): string {
  return ROLE_LABEL[role as keyof typeof ROLE_LABEL] ?? role;
}

function ParticipantCard({
  projectId,
  participant,
}: {
  projectId: string;
  participant: ProjectParticipant;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const removeParticipant = useRemoveParticipant();

  function handleDelete(): void {
    removeParticipant.mutate(
      { projectId, participantId: participant.id },
      { onSuccess: () => setDeleteOpen(false) }
    );
  }

  const isOwner = participant.role === "owner";
  
  return (
    <Card padding="lg" className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Avatar name={participant.name ?? participant.email} size="md" />
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-900">
            {participant.name ?? participant.email}
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            {participant.name && (
              <>
                <span className="text-xs text-gray-500">{participant.email}</span>
                <span className="text-xs text-gray-300">•</span>
              </>
            )}
            <span className="text-xs text-gray-500">
              {roleLabel(participant.role)}
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {isOwner ? (
          <Badge tone="info">Owner</Badge>
        ) : participant.status === "invited" ? (
          <Badge tone="neutral">Invited</Badge>
        ) : participant.status === "active" ? (
          <Badge tone="success">Active</Badge>
        ) : null}

        {!isOwner && (
          <>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="ml-2 text-xs font-medium text-red-500 hover:text-red-600"
            >
              Remove
            </button>
            <ConfirmDialog
              open={deleteOpen}
              onOpenChange={setDeleteOpen}
              onConfirm={handleDelete}
              title="Remove access"
              description={`Are you sure you want to remove ${participant.name ?? participant.email}'s access to this project?`}
              confirmLabel="Remove"
              variant="danger"
            />
          </>
        )}
      </div>
    </Card>
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
              className="font-medium text-[#004DE7] hover:underline"
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
