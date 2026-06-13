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
import { useProjectContext } from "@/layouts/project-layout";
import {
  useProjectTeam,
  useCreateTeamMember,
  useEditTeamMember,
  useDeleteTeamMember,
  type TeamMember,
} from "@/hooks/use-team";

export default function ProjectTeam() {
  const { project } = useProjectContext();
  const { data: members = [] } = useProjectTeam(project.id);
  const [createOpen, setCreateOpen] = useState(false);
  const createMember = useCreateTeamMember();

  function handleCreate(values: UpsertTeamMemberValues): void {
    createMember.mutate(
      { projectId: project.id, ...values },
      { onSuccess: () => setCreateOpen(false) },
    );
  }

  return (
    <div className="w-full px-6 py-8 sm:px-10">
      <PageHeader
        title="Project Team"
        description="The people delivering this build, their roles, and how to reach them."
        actions={
          <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
            <PlusIcon className="size-4" />
            Add Team Member
          </Button>
        }
      />

      <UpsertTeamMemberDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onSubmit={handleCreate}
        isSubmitting={createMember.isPending}
        error={(createMember.error as Error | undefined)?.message ?? null}
      />

      <section className="mt-8">
        {members.length === 0 ? (
          <Card padding="lg">
            <EmptyState
              icon={<ContractorsIcon className="size-6" />}
              title="No team members yet"
              description="Add the engineers, contractors, and managers working on this project to keep everyone aligned."
              action={
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setCreateOpen(true)}
                >
                  <PlusIcon className="size-4" />
                  Add Team Member
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
        <p className="text-sm text-gray-600 text-pretty">
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
