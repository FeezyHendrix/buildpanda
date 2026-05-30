import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { IconBox } from "@/components/atoms/icon-box";
import { ProgressBar } from "@/components/atoms/progress-bar";
import {
  ExternalLinkIcon,
  FolderIcon,
  PlusIcon,
} from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { useSession } from "@/stores/auth";
import { useProjects } from "@/hooks/use-projects";
import {
  firstName,
  formatCurrency,
  formatTimeAgo,
  timeOfDay,
} from "@/lib/formatters";
import type { Project } from "@/lib/project-mock-data";
import emptyIcon from "@/assets/images/empty-icon.svg";

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const { data: projects, isPending } = useProjects();

  if (isPending) {
    return <LoadingSpinner />;
  }

  const list = projects ?? [];

  if (list.length === 0) {
    return <DashboardEmptyState onCreate={() => navigate("/project/create")} />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16 pt-12 sm:pt-20">
      <Greeting name={session?.user.name ?? ""} />

      <section className="mt-10">
        <div className="mb-4 flex items-center gap-2">
          <FolderIcon className="size-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Projects</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
          <NewProjectCard />
        </div>
      </section>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex flex-1 items-center justify-center pt-32">
      <div className="size-8 animate-spin rounded-full border-2 border-gray-300 border-t-[#004DE7]" />
    </div>
  );
}

function Greeting({ name }: { name: string }) {
  return (
    <h1 className="text-2xl font-bold sm:text-[28px]">
      <span className="text-gray-500">Good {timeOfDay()}, </span>
      <span className="text-gray-900">{firstName(name)}.</span>
    </h1>
  );
}

function DashboardEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-1 items-start justify-center pt-[150px]">
      <EmptyState
        icon={<img src={emptyIcon} alt="" className="size-[159px]" />}
        title="Welcome to Build Panda"
        description="Build and manage your construction projects in Nigeria with complete transparency and control — no matter where you live."
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

function ProjectCard({ project }: { project: Project }) {
  const progress = project.progressPercent;
  return (
    <Card padding="md" className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <IconBox
          tone={project.folderTone}
          size="md"
          icon={<FolderIcon className="size-5" />}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-gray-900">
            {project.name}
          </p>
          <p className="line-clamp-2 text-xs text-gray-500">
            {project.address}
          </p>
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs text-gray-500">
          <span>Completion</span>
          <span className="font-semibold tabular-nums text-gray-900">
            {progress}%
          </span>
        </div>
        <ProgressBar value={progress} tone="success" size="sm" />
      </div>

      <div>
        <p className="text-xs text-gray-500">Budget Usage</p>
        <p className="mt-0.5 text-sm font-semibold tabular-nums text-gray-900">
          {formatCurrency(project.budgetUsed, project.currency)}
          <span className="font-normal text-gray-400">
            {" "}
            / {formatCurrency(project.budgetTotal, project.currency)}
          </span>
        </p>
      </div>

      <div className="flex items-center justify-between border-t border-[#F0F0F0] pt-3">
        <p className="text-xs text-gray-500">
          Last updated {formatTimeAgo(project.updatedAt)}
        </p>
        <Link
          to={`/project/${project.id}/overview`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#004DE7] hover:underline"
        >
          Open
          <ExternalLinkIcon className="size-3.5" />
        </Link>
      </div>
    </Card>
  );
}

function NewProjectCard() {
  return (
    <Link
      to="/project/create"
      className="group flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#BFD3FF] bg-[#F5F8FF] p-6 text-center transition-colors hover:bg-[#EBF2FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004DE7]/30"
    >
      <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-white text-[#004DE7] shadow-sm ring-1 ring-[#BFD3FF]">
        <PlusIcon className="size-6" />
      </div>
      <p className="text-sm font-semibold text-[#004DE7]">New project</p>
      <p className="text-xs text-gray-500">
        Spin up a new construction project from scratch.
      </p>
    </Link>
  );
}
