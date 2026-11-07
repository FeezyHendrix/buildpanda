import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/atoms/button";
import { InviteParticipantDrawer } from "@/components/molecules/invite-participant-drawer";
import { useSetPageTitle } from "@/contexts/page-title-context";
import { useUrlState } from "@/hooks/use-url-state";
import { useProjectContext } from "@/layouts/project-layout";
import type { ProjectParticipant } from "@/lib/project-types";
import { ContactsTab } from "./team/contacts-tab";
import { ProjectTeamTab } from "./team/project-team-tab";
import { TEAM_TABS, type TeamTabId } from "./team/shared";
import { TeamTabs } from "./team/team-tabs";

const TAB_IDS = TEAM_TABS.map((t) => t.id);

/**
 * My Team: the people with access to the project, and the contacts delivering
 * it. The tab lives in `?tab=`, so a link or a reload lands on the same list.
 */
export default function ProjectTeam() {
  useSetPageTitle("My Team", "The people on this project and the contacts delivering it.");
  const { project } = useProjectContext();
  const [tab, setTab] = useUrlState<TeamTabId>("tab", "team", TAB_IDS);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProjectParticipant | undefined>();
  const [createOpen, setCreateOpen] = useState(false);

  function openInvite(): void {
    setEditTarget(undefined);
    setDrawerOpen(true);
  }

  function openEdit(participant: ProjectParticipant): void {
    setEditTarget(participant);
    setDrawerOpen(true);
  }

  return (
    <div className="w-full px-4 pt-6 pb-8 lg:pl-8 lg:pr-[40px]">
      <div className="flex items-center justify-between gap-3">
        <TeamTabs value={tab} onChange={setTab} />
        {tab === "team" ? (
          <Button type="button" size='lg' variant="primary" onClick={openInvite} className="h-[36px] gap-[6px] pl-[19px] pr-[16px] text-[14px]">
            <Plus className="size-[16px]" strokeWidth={1.5} />
            Invite member
          </Button>
        ) : (
          <Button type="button" size='lg' variant="primary" onClick={() => setCreateOpen(true)} className="h-[36px] gap-[6px] pl-[19px] pr-[16px] text-[14px]">
            <Plus className="size-[16px]" strokeWidth={1.5} />
            Add Contact
          </Button>
        )}
      </div>

      {tab === "team" ? (
        <ProjectTeamTab projectId={project.id} onEdit={openEdit} />
      ) : (
        <ContactsTab projectId={project.id} createOpen={createOpen} onCreateOpenChange={setCreateOpen} />
      )}

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
    </div>
  );
}
