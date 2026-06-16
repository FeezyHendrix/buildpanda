
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { Card } from "@/components/atoms/card";
import { ProgressBar } from "@/components/atoms/progress-bar";
import {
  ExternalLinkIcon,
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
import type { Project } from "@/lib/project-types";
import emptyIcon from "@/assets/images/empty-icon.svg";
import { icons } from "@/assets/icons/icons";
import { ReactSVG } from "react-svg"

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
    // <div className="mx-auto w-full max-w-5xl px-6 pb-16 pt-12 sm:pt-20">
    <div className="flex min-h-[calc(100vh-4rem)] flex-col py-10 max-w-7xl mx-auto w-full">
      <Greeting name={session?.user.name ?? ""} />

      <section className="flex flex-col gap-4 mt-10">
        <div className="flex items-center gap-1 ml-14">
          <ReactSVG src={icons.folder} />
          {/* <FolderIcon className="size-5 text-gray-500" /> */}
          <h2 className="text-[13px] font-medium text-black-300">Projects</h2>
        </div>

        {/* <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"> */}
        <div className="flex flex-wrap justify-center gap-6">
          {list.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
          <NewProjectCard />
          <ImportProgrammeCard />
        </div>
      </section>
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

function Greeting({ name }: { name: string }) {
  return (
    <h1 className="sm:text-[28px] text-center mb-6 text-[25px] font-semibold  text-black-300">
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
    <Card
      padding="md"
      className="relative flex flex-col gap-6 justify-between border-[0.5px] border-grey-100 transition-shadow hover:shadow-md rounded-[16px] p-8 w-[334.82px]"
    >
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
    </Card>
  );
}

function NewProjectCard() {
  return (
    <Link
      to="/project/create"
      className='flex flex-col items-center cursor-pointer justify-center gap-1 border-[1.5px] border-primary rounded-2xl p-8 w-[334.82px] border-dashed'
    //   className="group flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#BFD3FF] bg-[#F5F8FF] p-6 text-center transition-colors hover:bg-[#EBF2FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004DE7]/30"
    >
      <ReactSVG src={icons.addFolder} />
      <p className='text-primary text-[16px] font-semibold'>New project</p>
      <p className="text-[11px] text-black-300">Spin up a new construction project from scratch.</p>
      {/* <div className='flex flex-col items-center cursor-pointer justify-center gap-1 border-[0.5px] border-primary rounded-2xl p-8 w-[334.82px]'>
          </div> */}
      {/* <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-white text-[#004DE7] shadow-sm ring-1 ring-[#BFD3FF]">
        <ReactSVG src={icons.addFolder} />
      </div>
      <p className="text-sm font-semibold text-[#004DE7]">New project</p>
      <p className="text-xs text-gray-500">
        Spin up a new construction project from scratch.
      </p> */}
    </Link>
  );
}

function ImportProgrammeCard() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate("/import")}
      className='flex flex-col items-center cursor-pointer justify-center gap-1 border-[1.5px] border-primary rounded-2xl p-8 w-[334.82px] border-dashed'
    >
      <ReactSVG src={icons.upload} />
      <p className='text-primary text-[16px] font-semibold'>Set up a project</p>
      <p className="text-[11px] text-black-300 text-center">Import a programme, BoQ, drawings or BIM models and we'll build the project for you.</p>
    </button>
  );
}

