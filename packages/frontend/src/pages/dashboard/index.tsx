
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/atoms/button";
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
            <p className="text-[13px] font-medium text-black-300">Here’s what’s happening with your projects today</p>
          </div>

          <div className="flex flex-col lg:flex-row w-full items-start lg:items-center justify-between !mb-0 lg:gap-0 gap-4">
            <div className="flex items-center gap-1">
              <ReactSVG src={icons.folder} />
              <h2 className="text-[13px] font-medium text-black-300">Projects</h2>
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
        <div className="fixed bottom-0 left-0 right-0 z-10 hidden border-t border-[#F0F0F0] bg-white px-4 py-4 lg:block lg:px-6">
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
          className={`fixed bottom-6 left-1/2 z-20 flex size-14 -translate-x-1/2 items-center justify-center rounded-full shadow-xl transition-transform active:scale-95 lg:hidden ${fabOpen ? "hidden" : ""}`}
          style={{ background: "linear-gradient(to bottom, #3121C1, #004DE7)" }}
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
            <div className="flex w-full flex-col gap-4 bg-white rounded-2xl p-4">
              <NewProjectCard onNavigate={closeFab} />
              <ImportProgrammeCard onNavigate={closeFab} />
            </div>
            <button
              type="button"
              onClick={closeFab}
              aria-label="Close"
              className="mt-1 flex size-12 items-center justify-center rounded-full bg-white/90 text-gray-500 shadow-md text-xl font-light"
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
    <h1 className={`sm:text-[28px] mb-6 text-[25px] font-semibold  text-black-300 ${className}`}>
      <span className="text-gray-500">Good {timeOfDay()}, </span>
      <span className="text-gray-900">{firstName(name)}.</span>
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
        icon={<img src={emptyIcon} alt="" className="size-[159px]" />}
        title="Welcome to Build Panda"
        description="Build and manage your construction projects in Nigeria with complete transparency and control, no matter where you live."
        action={
          <Button
            variant="ghost"
            size="md"
            className="text-base font-semibold leading-[120%] text-[#004DE7] hover:bg-[#004DE7]/5 active:bg-[#004DE7]/10"
            onClick={onCreate}
          >
            <PlusIcon className="size-5" />
            Create your first project
          </Button>
        }
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
      className="relative flex flex-col gap-6 justify-between border-[0.5px] border-grey-100 transition-shadow hover:shadow-md rounded-[16px] p-8 lg:w-[334.82px] w-full"
    >
      <button
        type="button"
        aria-label={`Delete ${project.name}`}
        onClick={() => setConfirmOpen(true)}
        className="absolute right-3 top-3 z-20 inline-flex size-8 items-center justify-center rounded-lg text-gray-400 outline-none transition-colors hover:bg-red-50 hover:text-red-500 focus-visible:ring-2 focus-visible:ring-red-500/30"
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
         <p className='text-[#0F172A] font-semibold'>{project.name}</p>
         <p className='text-[13px] text-black-300'>{project.address}</p>   
        </div>
        {/* <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-gray-900">
            {project.name}
          </p>
          <p className="line-clamp-2 text-xs text-gray-500">
            {project.address}
          </p>
        </div> */}
      </div>

      {/* <div className='flex flex-col gap-2'>
        <div className="mb-1.5 flex items-center justify-between text-xs text-gray-500">
          <span>Completion</span>
          <span className="font-semibold tabular-nums text-gray-900">
            {progress}%
          </span>
        </div>
        <ProgressBar value={progress} tone="success" size="sm" />
      </div> */}

      <div className='flex flex-col gap-2'>
        <div className="flex justify-between">
          <p className='text-black-300 text-[11px]'>Completion</p>
          <p className="text-[13px] text-black-500 font-semibold">{progress}%</p>
        </div>
        <ProgressBar value={progress} tone="success" size="sm" className='h-[7px]' />
      </div>

      <div>
        <p className="text-black-300 text-[11px]">Budget Usage</p>
        <p className="text-[13px] font-semibold text-black-500">
          {formatCurrency(project.budgetUsed, project.currency)}
          <span className="text-black-300">
            {" "}
            / {formatCurrency(project.budgetTotal, project.currency)}
          </span>
        </p>
      </div>

      {/* {activePhase && (
        <Link
          to={`/project/${project.id}/project-chart`}
          className="relative z-10 rounded-xl border border-[#EDEDED] bg-[#FAFAFA] p-3 outline-none transition-colors hover:bg-[#F4F7FF] focus-visible:ring-2 focus-visible:ring-[#004DE7]/20"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-900">
                <CalendarIcon className="size-3.5 text-[#004DE7]" />
                Project schedule
              </p>
              <p className="mt-1 truncate text-xs text-gray-500">
                {activePhase.name}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-medium text-gray-500 ring-1 ring-[#EDEDED]">
              {activePhase.dateRange || "Timeline"}
            </span>
          </div>
        </Link>
      )} */}

      <div className="flex items-center justify-between border-t border-[#F0F0F0] pt-3">
        <p className="text-xs text-gray-500">
          Last updated {formatTimeAgo(project.updatedAt)}
        </p>
        <Link
          to={`/project/${project.id}/overview`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#004DE7] outline-none hover:underline after:absolute after:inset-0 after:z-[1] after:rounded-2xl after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-[#004DE7]/20"
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
      className="flex flex-1 items-center gap-4 rounded-2xl p-4 transition-opacity hover:opacity-90"
      style={{ background: "linear-gradient(to bottom, #3121C1, #004DE7)" }}
    >
      <div className="shrink-0">
        <ReactSVG src={icons.folderWhite} />
      </div>
      <div>
        <p className="text-[16px] font-semibold text-white">New project</p>
        <p className="text-[11px] text-white/75">
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
      className="flex flex-1 items-center gap-4 rounded-2xl border border-primary bg-white p-4 transition-colors hover:bg-gray-50"
    >
      <div className="shrink-0">
        <ReactSVG src={icons.folderArrow} />
      </div>
      <div className="text-left">
        <p className="text-[16px] font-semibold text-primary">Set up a project</p>
        <p className="text-[11px] text-black-300">
          Import a programme, BoQ, drawings or BIM models and we'll build the project for you.
        </p>
      </div>
    </button>
  );
}

