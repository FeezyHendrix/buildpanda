import { Link } from "react-router-dom";
import { useProjectContext } from "@/layouts/project-layout";
import { useProjectDocuments } from "@/hooks/use-documents";
import { useParticipants } from "@/hooks/use-participants";
import { canResourceAction } from "@/lib/project-types";
import { Card } from "@/components/atoms/card";

export function ProjectSetupChecklist() {
  const { project, access } = useProjectContext();
  if (!access || project.progressPercent > 0) return null;
  return <SetupSteps />;
}

function SetupSteps() {
  const { project, access } = useProjectContext();
  const canInvite = canResourceAction(access, "participants", "manage");
  const canUpload = canResourceAction(access, "documents", "upload");
  const documents = useProjectDocuments(canUpload ? project.id : undefined);
  const people = useParticipants(project.id, canInvite);
  const steps = [
    { title: "Invite your team", to: "team", done: (people.data?.length ?? 0) > 1, allowed: canInvite && people.isSuccess },
    { title: "Add a plan", to: "plans", done: documents.data?.some(document => document.group === "plan"), allowed: canUpload && documents.isSuccess },
    { title: "Set up the programme", to: "schedules/stages", done: project.timeline.length > 0, allowed: canResourceAction(access, "schedule", "manage") },
    { title: "Set the budget", to: "settings", done: project.budgetMin !== null, allowed: canResourceAction(access, "finances", "manage") },
  ].filter(step => step.allowed && !step.done);
  if (!steps.length) return null;
  return <Card className="my-4 p-5">
    <h2 className="font-semibold">Set up your project</h2>
    <p className="mt-1 text-sm text-ink-muted">Choose the next useful step. You can return to this checklist later.</p>
    <ul className="mt-3 flex flex-wrap gap-4">
      {steps.map(step => <li key={step.to}><Link className="text-sm text-primary-500 underline" to={`/project/${project.id}/${step.to}`}>{step.title}</Link></li>)}
    </ul>
  </Card>;
}
