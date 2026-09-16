import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { Badge } from "@/components/atoms/badge";
import { Spinner } from "@/components/atoms/spinner";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/atoms/dropdown-menu";
import { EmptyState } from "@/components/molecules/empty-state";
import { PendingInvitesBanner } from "@/components/molecules/pending-invites-banner";
import { useProjects, useDeleteProject } from "@/hooks/use-projects";
import { useHasOrgPermission } from "@/hooks/use-organization";
import { useSession } from "@/stores/auth";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/project-types";
import emptyIcon from "@/assets/images/empty-dashboard.svg";
import { icons2 } from "@/assets/icons2/icon2";
import { ReactSVG } from "react-svg";

function getGreeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: projects, isPending } = useProjects();
  const { data: session } = useSession();
  const canCreateProject = useHasOrgPermission("project", "create");
  const [view, setView] = useState<"grid" | "list">("grid");
  const greeting = getGreeting(new Date().getHours());
  const firstName = (session?.user?.name ?? "").trim().split(" ")[0];

  if (isPending) return <LoadingSpinner />;

  const list = projects ?? [];

  if (list.length === 0) {
    return canCreateProject ? (
      <DashboardEmptyState onCreate={() => navigate("/project/create")} />
    ) : (
      <NoAssignedProjectsState />
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 lg:px-8">
      <div className="mb-6">
        <PendingInvitesBanner />
      </div>

      {/* Page header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h5 className="text-h5 font-semibold !text-[#686868]">
            {greeting}
            {firstName && <span className="text-black">, {firstName}</span>}
          </h5>
          <p className="mt-1 text-caption-m font-medium text-black-500 opacity-50">
            {list.length} project{list.length !== 1 ? "s" : ""} available
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => setView("list")}
              className={cn(
                "flex w-9 items-center justify-center transition-colors hover:bg-[#E6EDFD]",
                view === "list" ? "border-primary bg-[#E6EDFD]" : "bg-white hover:bg-[#E6EDFD]",
              )}
              aria-label="List view"
            >
              <ReactSVG
                src={icons2.list}
                className={cn("transition-colors", view === "list" ? "[&_path]:fill-primary" : "[&_path]:fill-black")}
              />
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => setView("grid")}
              className={cn(
                "flex w-9 items-center justify-center transition-colors",
                view === "grid" ? "border-primary bg-[#E6EDFD]" : "bg-white hover:bg-[#F5F5F5]",
              )}
              aria-label="Grid view"
            >
              <ReactSVG
                src={icons2.grid}
                className={cn("transition-colors", view === "grid" ? "[&_path]:fill-primary" : "[&_path]:fill-black")}
              />
            </Button>
          </div>

          {/* New Project */}
          {canCreateProject && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="primary"
                    size="md"
                    className="gap-2"
                    aria-label="New project options"
                  >
                    <ReactSVG src={icons2.plus} className='[&_svg]:size-[14px] [&_path]:fill-white shrink-0' />
                    New Project
                    <ChevronDownIcon />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className='p-2 w-[380px]'>
                <DropdownMenuItem onSelect={() => navigate("/project/create")} className='flex items-center gap-2'>
                  <ReactSVG src={icons2.folderAdd} />
                  <div className='flex flex-col'>
                    <span className="text-caption-l font-semibold text-black-700">Start a New project</span>
                    <span className="text-caption-m font-medium text-grey-450">Spin up a new construction project from scratch</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate("/import")} className='flex items-center gap-2'>
                  <ReactSVG src={icons2.folderImport} />
                  <div className='flex flex-col'>
                    <span className="text-caption-l font-semibold text-black-700">Import Project</span>
                    <span className="text-caption-m font-medium text-grey-450">Import a programme, BOQ, drawings or BIM and we'll build the project for you</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Project grid / list */}
      <div
        className={cn(
          "grid gap-4",
          view === "grid"
            ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3"
            : "grid-cols-1",
        )}
      >
        {list.map((project) => (
          <ProjectCard key={project.id} project={project} view={view} />
        ))}
      </div>
    </div>
  );
}

// ── Project card ──────────────────────────────────────────────────────────────

function ProjectCard({ project, view }: { project: Project; view: "grid" | "list" }) {
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const deleteProject = useDeleteProject();

  function handleDelete() {
    deleteProject.mutate(project.id, {
      onSuccess: () => toast(`"${project.name}" was deleted`, "success"),
      onError: () => toast("Could not delete project. Please try again."),
    });
  }

  const cardMenu = (
    <div
      className="flex gap-1"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {project.name !== "Sample Project" && (
        <>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/project/${project.id}/overview`);
            }}
            className="w-6 h-6 flex items-center justify-center"
          >
            <ReactSVG
              src={icons2.edit}
              className="[&_path]:fill-[#A1A1A1] hover:[&_path]:fill-black-500 [&_svg]:size-4.5"
            />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmOpen(true);
            }}
            className="w-6 h-6 flex items-center justify-center"
          >
            <ReactSVG
              src={icons2.delete}
              className="[&_path]:fill-[#A1A1A1] hover:[&_path]:fill-red-500 [&_svg]:size-4.5"
            />
          </Button>
        </>
      )}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleDelete}
        title="Delete project"
        description={`This permanently deletes "${project.name}" and all of its data. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );

  if (view === "list") {
    return (
      <div
        role="link"
        tabIndex={0}
        onClick={() => navigate(`/project/${project.id}/overview`)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            navigate(`/project/${project.id}/overview`);
          }
        }}
        className="flex cursor-pointer items-center gap-4 border border-[#F0F0F0] bg-white px-5 py-4 transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004DE7]/20"
      >
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <ReactSVG src={icons2.folder} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-caption-l font-semibold text-black-700">{project.name}</p>
            <p className="truncate text-[13px] text-[#B0B0B0]">{project.address}</p>
          </div>
          <Badge tone="danger" variant="soft" size="md" className="shrink-0">
            {project.progressPercent}% Completed
          </Badge>
        </div>
        {cardMenu}
      </div>
    );
  }

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => navigate(`/project/${project.id}/overview`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(`/project/${project.id}/overview`);
        }
      }}
      className="relative cursor-pointer border-[0.5px] border-[#DDDDDD] bg-white p-5 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004DE7]/20"
    >
      {/* Top row */}
      <div className="mb-8 flex items-center justify-between">
        {project.name === "Sample Project" ? (
          <ReactSVG src={icons2.folderGrey} className="[&_svg]:size-[60px] shrink-0" />
        ) : (
          <ReactSVG src={icons2.folder} className="[&_svg]:size-[60px] shrink-0" />
        )}
        {cardMenu}
      </div>

      {/* Name + address */}
      <div className="mt-1 block">
        <Badge variant="outline" size="sm" className="mb-3">
          {project.progressPercent}% Completed
        </Badge>
        <p className="line-clamp-1 text-body-s font-semibold text-black-700">{project.name}</p>
        <p className="mt-0.5 text-caption-m font-medium text-black-500 opacity-50">{project.address}</p>
      </div>
    </div>
  );
}

// ── Loading / empty states ────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="flex flex-1 items-center justify-center pt-32">
      <Spinner size="lg" />
    </div>
  );
}

function DashboardEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-6 pt-10">
      <div className="w-full max-w-2xl px-4">
        <PendingInvitesBanner />
      </div>
      <EmptyState
        icon={<img src={emptyIcon} alt="" className="size-90" />}
        title="Welcome to your workspace!"
        description="Your workspace is empty for now. Create your first project and start planning, building and collaborating with your team"
        action={
          <Button
            variant="primary"
            size="lg"
            className="text-base font-semibold w-full"
            onClick={onCreate}
          >
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
