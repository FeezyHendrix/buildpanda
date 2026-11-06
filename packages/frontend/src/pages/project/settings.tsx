import { useState } from "react";
import { useSetPageTitle } from "@/contexts/page-title-context";
import { QueryError } from "@/components/molecules/query-error";
import { AiUpdateCadenceSection } from "@/components/molecules/ai-update-cadence-section";
import { EditBudgetDrawer } from "@/components/molecules/edit-budget-drawer";
import { useProjectContext } from "@/layouts/project-layout";
import { GeneralTab } from "./settings/general-tab";
import { MoneyTab } from "./settings/money-tab";
import { ProgrammeTab } from "./settings/programme-tab";
import { SettingsTabBar, useSettingsTab } from "./settings/settings-tabs";
import { useProfileDraft } from "./settings/use-profile-draft";

/**
 * Settings is a set of separate records — who the parties are, when the job
 * runs, what it is worth, how Panda AI drafts — so it reads as tabs rather than
 * one long stack of unrelated cards.
 */
export default function ProjectSettings() {
  useSetPageTitle("Settings", "Manage this project's details, programme, money and Panda AI.");
  const { project, access } = useProjectContext();
  const canManage = access?.capabilities?.canManage ?? false;
  const { tab, setTab } = useSettingsTab();
  const [editBudgetOpen, setEditBudgetOpen] = useState(false);
  // One draft shared by General and Programme; each tab saves only its own fields.
  const profile = useProfileDraft(project.id);
  const profileAvailable = !profile.error || Boolean(profile.draft);

  return (
    <div className="w-full px-4 pt-10 pb-8 lg:px-8">
      <SettingsTabBar value={tab} onChange={setTab} />

      <div className="mt-11 max-w-[1003px] sm:ml-[43px] sm:w-[calc(100%-86px)]">
        {(tab === "general" || tab === "programme") && profile.error ? (
          <QueryError error={profile.error} retry={profile.refetch} noun="project settings" />
        ) : null}
        {tab === "general" && profileAvailable ? <GeneralTab canManage={canManage} profile={profile} /> : null}
        {tab === "programme" && profileAvailable ? <ProgrammeTab canManage={canManage} profile={profile} /> : null}
        {tab === "money" ? (
          <MoneyTab
            project={project}
            canManage={canManage}
            onEditBudget={() => setEditBudgetOpen(true)}
          />
        ) : null}
        {tab === "panda-ai" ? (
          <AiUpdateCadenceSection projectId={project.id} canManage={canManage} />
        ) : null}
      </div>

      <EditBudgetDrawer project={project} open={editBudgetOpen} onOpenChange={setEditBudgetOpen} />
    </div>
  );
}
