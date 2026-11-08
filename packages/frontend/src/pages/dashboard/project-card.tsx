import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ReactSVG } from "react-svg";
import { Badge } from "@/components/atoms/badge";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { icons2 } from "@/assets/icons2/icon2";
import { useDeleteProject } from "@/hooks/use-projects";
import { toast } from "@/lib/toast";
import type { Project } from "@/lib/project-types";

const ICON_BUTTON =
  "flex size-[24px] items-center justify-center border border-[#EEEEEE] bg-white outline-none hover:bg-[#F5F5F5] focus-visible:ring-2 focus-visible:ring-gray-900/10";

export function ProjectCard({ project }: { project: Project }) {
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const deleteProject = useDeleteProject();
  const open = () => navigate(`/project/${project.id}/overview`);

  function handleDelete() {
    deleteProject.mutate(project.id, {
      onSuccess: () => toast(`"${project.name}" was deleted`, "success"),
      onError: () => toast("Could not delete project. Please try again."),
    });
  }

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      className="relative cursor-pointer border border-[#EEEEEE] bg-white px-[20px] pb-[24px] pt-[22px] transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004DE7]/20"
    >
      <div className="mb-[33px] flex items-center justify-between">
        <ReactSVG src={project.name === "Sample Project" ? icons2.folderGrey : icons2.folder} className="[&_svg]:size-[60px] shrink-0" />
        {project.name !== "Sample Project" ? (
          <div className="flex gap-[8px]" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
            <button type="button" aria-label={`Edit ${project.name}`} onClick={open} className={ICON_BUTTON}>
              <ReactSVG src={icons2.edit} className="[&_path]:fill-[#A1A1A1] hover:[&_path]:fill-black-500 [&_svg]:size-4" />
            </button>
            <button type="button" aria-label={`Delete ${project.name}`} onClick={() => setConfirmOpen(true)} className={ICON_BUTTON}>
              <ReactSVG src={icons2.delete} className="[&_path]:fill-[#A1A1A1] hover:[&_path]:fill-red-500 [&_svg]:size-4" />
            </button>
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
        ) : null}
      </div>

      <Badge variant="outline" size="sm" className="mb-[8px]">
        {project.progressPercent}% Completed
      </Badge>
      <p className="line-clamp-1 text-[16px] font-semibold leading-[24px] text-black-700">{project.name}</p>
      <p className="mt-[4px] truncate text-[12px] font-medium leading-[16px] text-black-500 opacity-50">{project.address}</p>
    </div>
  );
}

ProjectCard.displayName = "ProjectCard";
