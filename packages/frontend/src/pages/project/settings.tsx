import { useState } from "react";
import { PageHeader } from "@/components/molecules/page-header";
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
  const { project, access } = useProjectContext();
  const canManage = access?.capabilities?.canManage ?? false;
  const { tab, setTab } = useSettingsTab();
  const [editBudgetOpen, setEditBudgetOpen] = useState(false);
  // One draft shared by General and Programme; each tab saves only its own fields.
  const profile = useProfileDraft(project.id);

  return (
    <div className="w-full px-6 py-8 sm:px-10">
      <PageHeader title="Settings" />

      <SettingsTabBar value={tab} onChange={setTab} />

      <div className="mt-6">
        {tab === "general" ? <GeneralTab canManage={canManage} profile={profile} /> : null}
        {tab === "programme" ? <ProgrammeTab canManage={canManage} profile={profile} /> : null}
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
