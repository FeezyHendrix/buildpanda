
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Spinner } from "@/components/atoms/spinner";
import { Card } from "@/components/atoms/card";
import { ProgressBar } from "@/components/atoms/progress-bar";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import {
  ExternalLinkIcon,
  PlusIcon,
} from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { useSession } from "@/stores/auth";
import { useProjects, useDeleteProject } from "@/hooks/use-projects";
import { useHasOrgPermission } from "@/hooks/use-organization";
import { toast } from "@/lib/toast";
import {
  firstName,
  formatCurrency,
  formatTimeAgo,
  timeOfDay,
} from "@/lib/formatters";
import type { Project } from "@/lib/project-types";
import emptyIcon from "@/assets/images/empty-icon.svg";
import { icons } from "@/assets/icons/icons";
import { ReactSVG } from "react-svg";
import { SuiteSwitcher } from "@/components/molecules/suite-switcher";
import { PendingInvitesBanner } from "@/components/molecules/pending-invites-banner";

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const { data: projects, isPending } = useProjects();
  const canCreateProject = useHasOrgPermission("project", "create");
  const [fabOpen, setFabOpen] = useState(false);
  const [fabClosing, setFabClosing] = useState(false);

  function closeFab() {
    setFabClosing(true);
    setTimeout(() => {
      setFabOpen(false);
      setFabClosing(false);
    }, 220);
  }

  if (isPending) {
    return <LoadingSpinner />;
  }

  const list = projects ?? [];

  if (list.length === 0) {
    return canCreateProject ? (
      <DashboardEmptyState onCreate={() => navigate("/project/create")} />
    ) : (
      <NoAssignedProjectsState />
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col py-10 pb-36 lg:max-w-7xl mx-auto w-full max-w-full lg:px-3 px-4">
      <div className="mb-4">
        <PendingInvitesBanner />
      </div>
      <div className="flex items-center justify-between mb-0">
        <div className="flex justify-center flex-1">
          <SuiteSwitcher variant="tabs" />
        </div>
      </div>

      <section className="flex flex-col gap-4 mt-10">
        <div className="mx-auto w-full lg:w-fit flex flex-col gap-4">
          <div className='flex flex-col !mb-6'>
            <Greeting className='self-start !mb-2' name={session?.user.name ?? ""} />
            <p className="text-sm font-medium text-ink-muted">Here’s what’s happening with your projects today</p>
          </div>

          <div className="flex flex-col lg:flex-row w-full items-start lg:items-center justify-between !mb-0 lg:gap-0 gap-4">
            <div className="flex items-center gap-1">
              <ReactSVG src={icons.folder} />
              <h2 className="text-sm font-medium text-ink-muted">Projects</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {list.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </div>
      </section>

      {/* Desktop fixed footer */}
      {canCreateProject && (
        <div className="fixed bottom-0 left-0 right-0 z-10 hidden border-t border-line-hair bg-white px-4 py-4 lg:block lg:px-6">
          <div className="mx-auto flex w-full max-w-fit gap-4 lg:max-w-4xl lg:px-3">
            <NewProjectCard />
            <ImportProgrammeCard />
          </div>
        </div>
      )}

      {/* Mobile FAB */}
      {canCreateProject && (
        <button
          type="button"
          onClick={() => setFabOpen(true)}
          aria-label="Create or import project"
          className={`fixed bottom-6 left-1/2 z-20 flex size-14 -translate-x-1/2 items-center justify-center rounded-full bg-primary-500 text-white shadow-lg transition-transform active:scale-95 lg:hidden ${fabOpen ? "hidden" : ""}`}
        >
          <PlusIcon className="size-7 text-white" />
        </button>
      )}

      {/* Mobile FAB popup */}
      {fabOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            style={{
              animation: fabClosing
                ? "fab-backdrop-out 220ms ease-in forwards"
                : "fab-backdrop-in 200ms ease-out",
            }}
            onClick={closeFab}
          />
          {/* Bottom sheet */}
          <div
            className="fixed bottom-0 left-0 right-0 z-40 flex flex-col items-center gap-3 px-4 pb-8 pt-4 lg:hidden"
            style={{
              animation: fabClosing
                ? "fab-sheet-out 220ms ease-in forwards"
                : "fab-sheet-in 250ms cubic-bezier(0.32, 0.72, 0, 1)",
            }}
          >
            <div className="flex w-full flex-col gap-4 bg-white rounded-lg p-4">
              <NewProjectCard onNavigate={closeFab} />
              <ImportProgrammeCard onNavigate={closeFab} />
            </div>
            <button
              type="button"
              onClick={closeFab}
              aria-label="Close"
              className="mt-1 flex size-12 items-center justify-center rounded-full bg-white/90 text-ink-muted shadow-md text-xl font-light"
            >
              ✕
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex flex-1 items-center justify-center pt-32">
      <Spinner size="lg" />
    </div>
  );
}

function Greeting({ name, className }: { name: string, className?: string }) {
  return (
    <h1 className={`sm:text-3xl mb-6 text-2xl font-semibold  text-ink-muted ${className}`}>
      <span className="text-ink-muted">Good {timeOfDay()}, </span>
      <span className="text-ink">{firstName(name)}.</span>
    </h1>
  );
}

function DashboardEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-6 pt-10">
      <div className="w-full max-w-2xl px-4">
        <PendingInvitesBanner />
      </div>
      <EmptyState
        illustration={<img src={emptyIcon} alt="" className="size-[159px]" />}
        title="Welcome to Build Panda"
        description="Build and manage your construction projects in Nigeria with complete transparency and control, no matter where you live."
        action={{ label: "Create your first project", onClick: onCreate, icon: <PlusIcon /> }}
      />
    </div>
  );
}

function NoAssignedProjectsState() {
  return (
    <div className="flex flex-1 flex-col items-center gap-6 pt-10">
      <div className="w-full max-w-2xl px-4">
        <PendingInvitesBanner />
      </div>
      <EmptyState
        icon={<img src={emptyIcon} alt="" className="size-[159px]" />}
        title="No projects yet"
        description="You'll see a project here as soon as your team adds you to one. Check back shortly or ask your workspace admin for access."
      />
    </div>
  );
}

function TrashIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const progress = project.progressPercent;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const deleteProject = useDeleteProject();

  const handleDelete = () => {
    deleteProject.mutate(project.id, {
      onSuccess: () => toast(`"${project.name}" was deleted`, "success"),
      onError: () => toast("Could not delete project. Please try again."),
    });
  };

  return (
    <Card
      padding="md"
      className="relative flex flex-col gap-6 justify-between transition-shadow hover:shadow-lg p-8 lg:w-[334.82px] w-full"
    >
      <button
        type="button"
        aria-label={`Delete ${project.name}`}
        onClick={() => setConfirmOpen(true)}
        className="absolute right-3 top-3 z-20 inline-flex size-8 items-center justify-center rounded-lg text-ink-muted outline-none transition-colors hover:bg-negative-50 hover:text-negative-500 focus-visible:shadow-focus"
      >
        <TrashIcon className="size-4" />
      </button>

      <div className="flex gap-8">
        {/* <IconBox
          tone={project.folderTone}
          size="md"
          icon={<FolderIcon className="size-5" />}
        /> */}
        <ReactSVG src={icons.coloredFolder} />
        <div className='text'>
         <p className='text-ink font-semibold'>{project.name}</p>
         <p className='text-sm text-ink-muted'>{project.address}</p>   
        </div>
        {/* <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-ink">
            {project.name}
          </p>
          <p className="line-clamp-2 text-xs text-ink-muted">
            {project.address}
          </p>
        </div> */}
      </div>

      {/* <div className='flex flex-col gap-2'>
        <div className="mb-1.5 flex items-center justify-between text-xs text-ink-muted">
          <span>Completion</span>
          <span className="font-semibold tabular-nums text-ink">
            {progress}%
          </span>
        </div>
        <ProgressBar value={progress} tone="success" size="sm" />
      </div> */}

      <div className='flex flex-col gap-2'>
        <div className="flex justify-between">
          <p className='text-ink-muted text-xs'>Completion</p>
          <p className="text-sm text-black-500 font-semibold">{progress}%</p>
        </div>
        <ProgressBar value={progress} tone="success" size="sm" className='h-[7px]' />
      </div>

      <div>
        <p className="text-ink-muted text-xs">Budget Usage</p>
        <p className="text-sm font-semibold text-black-500">
          {formatCurrency(project.budgetUsed, project.currency)}
          <span className="text-ink-muted">
            {" "}
            / {formatCurrency(project.budgetTotal, project.currency)}
          </span>
        </p>
      </div>

      {/* {activePhase && (
        <Link
          to={`/project/${project.id}/project-chart`}
          className="relative z-10 rounded-lg border border-line-hair bg-surface-alt p-3 outline-none transition-colors hover:bg-primary-50 focus-visible:shadow-focus"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                <CalendarIcon className="size-3.5 text-primary-500" />
                Project schedule
              </p>
              <p className="mt-1 truncate text-xs text-ink-muted">
                {activePhase.name}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-medium text-ink-muted border border-line-hair">
              {activePhase.dateRange || "Timeline"}
            </span>
          </div>
        </Link>
      )} */}

      <div className="flex items-center justify-between border-t border-line-hair pt-3">
        <p className="text-xs text-ink-muted">
          Last updated {formatTimeAgo(project.updatedAt)}
        </p>
        <Link
          to={`/project/${project.id}/overview`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary-500 outline-none hover:underline after:absolute after:inset-0 after:z-[1] after:rounded-lg after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-primary-500/20"
        >
          Open
          <ExternalLinkIcon className="size-3.5" />
        </Link>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleDelete}
        title="Delete project"
        description={`This permanently deletes "${project.name}" and all of its data. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </Card>
  );
}

function NewProjectCard({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      to="/project/create"
      onClick={onNavigate}
      className="flex flex-1 items-center gap-4 rounded-lg border border-line-hair bg-white p-4 transition-colors hover:bg-surface-alt"
    >
      <div className="shrink-0">
        <ReactSVG src={icons.addFolder} className="text-ink-muted" />
      </div>
      <div>
        <p className="text-base font-semibold text-ink">New project</p>
        <p className="text-xs text-ink-muted">
          Spin up a new construction project from scratch.
        </p>
      </div>
    </Link>
  );
}

function ImportProgrammeCard({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => { onNavigate?.(); navigate("/import"); }}
      className="flex flex-1 items-center gap-4 rounded-lg border border-primary bg-white p-4 transition-colors hover:bg-surface-alt"
    >
      <div className="shrink-0">
        <ReactSVG src={icons.folderArrow} />
      </div>
      <div className="text-left">
        <p className="text-base font-semibold text-primary">Set up a project</p>
        <p className="text-xs text-ink-muted">
          Import a programme, BoQ, drawings or BIM models and we'll build the project for you.
        </p>
      </div>
    </button>
  );
}

