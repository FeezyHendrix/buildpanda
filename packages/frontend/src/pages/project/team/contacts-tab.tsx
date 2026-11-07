import { ContractorsIcon } from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { UpsertTeamMemberDialog, type UpsertTeamMemberValues } from "@/components/molecules/upsert-team-member-dialog";
import { useCreateTeamMember, useProjectTeam } from "@/hooks/use-team";
import { errorMessage } from "@/lib/api-error";
import { ContactCard } from "./contact-card";

/** The reference contacts for this build, three to a row on a wide screen. */
export function ContactsTab({
  projectId,
  createOpen,
  onCreateOpenChange,
}: {
  projectId: string;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}) {
  const { data: members = [] } = useProjectTeam(projectId);
  const createMember = useCreateTeamMember();

  function handleCreate(values: UpsertTeamMemberValues): void {
    createMember.mutate({ projectId, ...values }, { onSuccess: () => onCreateOpenChange(false) });
  }

  return (
    <section className="mt-[36px]">
      <h2 className="text-[14px] font-semibold leading-[20px] text-[#1E1E1E]">Contacts</h2>
      <p className="mt-[2px] text-[12px] leading-[16px] text-[#737373]">
        People delivering this build — for reference only, does not grant access.
      </p>

      <UpsertTeamMemberDialog
        open={createOpen}
        onOpenChange={onCreateOpenChange}
        mode="create"
        onSubmit={handleCreate}
        isSubmitting={createMember.isPending}
        error={createMember.error ? errorMessage(createMember.error) : null}
      />

      {members.length === 0 ? (
        <div className="mt-[24px]">
          <EmptyState
            icon={<ContractorsIcon />}
            title="No contacts yet"
            description="Add the engineers, contractors and managers working on this project."
            action={{ label: "Add contact", onClick: () => onCreateOpenChange(true) }}
          />
        </div>
      ) : (
        <div className="mt-[17px] grid grid-cols-1 gap-x-[20px] gap-y-[21px] md:grid-cols-2 xl:grid-cols-3">
          {members.map((member) => (
            <ContactCard key={member.id} projectId={projectId} member={member} />
          ))}
        </div>
      )}
    </section>
  );
}

ContactsTab.displayName = "ContactsTab";
