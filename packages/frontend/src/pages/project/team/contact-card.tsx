import { useState } from "react";
import { ReactSVG } from "react-svg";
import { icons2 } from "@/assets/icons2/icon2";
import { Avatar } from "@/components/atoms/avatar";
import { Badge } from "@/components/atoms/badge";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { UpsertTeamMemberDialog, type UpsertTeamMemberValues } from "@/components/molecules/upsert-team-member-dialog";
import { useDeleteTeamMember, useEditTeamMember, type TeamMember } from "@/hooks/use-team";
import { errorMessage } from "@/lib/api-error";

const ICON_BUTTON =
  "flex size-[24px] items-center justify-center border border-[#F0F0F0] bg-white outline-none transition-colors hover:bg-[#F5F5F5] focus-visible:ring-2 focus-visible:ring-gray-900/10";

/** A reference contact: who they are, how to reach them, what they do. It grants no access. */
export function ContactCard({ projectId, member }: { projectId: string; member: TeamMember }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const editMember = useEditTeamMember();
  const deleteMember = useDeleteTeamMember();

  function handleEdit(values: UpsertTeamMemberValues): void {
    editMember.mutate({ projectId, memberId: member.id, ...values }, { onSuccess: () => setEditOpen(false) });
  }

  return (
    <article className="border border-[#EEEEEE] bg-white px-[16px] pb-[14px] pt-[16px]">
      <div className="flex items-center gap-[16px]">
        <Avatar name={member.name} className="size-[40px] bg-[#E6EDFD] text-[14px] text-[#004DE7]" />
        <div className="min-w-0 flex-1 text-[12px] leading-[20px]">
          <div className="flex items-center gap-2">
            <p className="truncate text-[14px] font-semibold text-[#1E1E1E]">{member.name}</p>
            {member.status === "Active" ? null : (
              <Badge tone="neutral" size="sm">
                {member.status}
              </Badge>
            )}
          </div>
          <p className="truncate text-[#737373]">
            {member.role}
            {member.company ? ` • ${member.company}` : ""}
          </p>
          {member.email || member.phone ? (
            <p className="truncate text-[#737373]">
              {member.email ? (
                <a href={`mailto:${member.email}`} className="text-[#004DE7] hover:underline">
                  {member.email}
                </a>
              ) : null}
              {member.email && member.phone ? " • " : null}
              {member.phone ? (
                <a href={`tel:${member.phone}`} className="text-[#00A63E] hover:underline">
                  {member.phone}
                </a>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>

      {member.responsibilities ? (
        <p className="mt-[7px] border-t border-[#F6F6F6] pt-[6px] text-[12px] leading-[20px] text-[#737373]">
          {member.responsibilities}
        </p>
      ) : null}

      <div className="mt-[23px] flex items-center gap-[8px]">
        <button type="button" onClick={() => setEditOpen(true)} aria-label={`Edit ${member.name}`} className={ICON_BUTTON}>
          <ReactSVG src={icons2.edit} className="[&_path]:fill-[#737373] [&_svg]:size-[14px]" />
        </button>
        <button type="button" onClick={() => setDeleteOpen(true)} aria-label={`Delete ${member.name}`} className={ICON_BUTTON}>
          <ReactSVG src={icons2.delete} className="[&_path]:fill-[#737373] [&_svg]:size-[14px]" />
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
        error={editMember.error ? errorMessage(editMember.error) : null}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => deleteMember.mutate({ projectId, memberId: member.id })}
        title="Remove team member"
        description="This removes the person from the project team. This action cannot be undone."
        confirmLabel="Remove"
        variant="danger"
      />
    </article>
  );
}

ContactCard.displayName = "ContactCard";
