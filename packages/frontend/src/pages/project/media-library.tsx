import { useState } from "react";
import { ReactSVG } from "react-svg";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { icons } from "@/assets/icons/icons";
import { PageHeader } from "@/components/molecules/page-header";
import { UploadDocumentDialog } from "@/components/molecules/upload-document-dialog";
import { FileViewerDialog } from "@/components/molecules/file-viewer-dialog";
import { PlayIcon } from "@/components/atoms/project-nav-icons";
import { useProjectContext } from "@/layouts/project-layout";
import {
  documentVersionViewUrl,
  useDeleteDocument,
  useProjectDocumentCategories,
  useProjectDocuments,
} from "@/hooks/use-documents";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api-error";
import { formatShortDate } from "@/lib/formatters";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { canResourceAction } from "@/lib/project-types";
import type { DocumentCategory, ProjectDocument } from "@/lib/project-types";
import { useDocumentUpload } from "./documents/use-document-upload";

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"]);
const VIDEO_EXTS = new Set(["mp4", "mov", "webm", "m4v", "avi", "mkv"]);

function fileExt(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function mediaViewUrl(projectId: string, doc: ProjectDocument): string | null {
  return doc.currentVersionId
    ? documentVersionViewUrl(projectId, doc.id, doc.currentVersionId)
    : null;
}

export default function ProjectMediaLibrary() {
  const { project, access } = useProjectContext();
  const canManage = Boolean(access && canResourceAction(access, "documents", "upload"));
  const { data: categories = [] } = useProjectDocumentCategories(project.id);
  const { data: documents = [] } = useProjectDocuments(project.id);
  const uploader = useDocumentUpload(project.id, "Media uploaded");
  const deleteDocument = useDeleteDocument();

  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [viewing, setViewing] = useState<ProjectDocument | null>(null);
  const [deleting, setDeleting] = useState<ProjectDocument | null>(null);

  const mediaCategories = categories.filter((c) => c.group === "media");
  const allMediaDocuments = documents.filter((d) => d.group === "media");
  const mediaDocuments =
    categoryFilter === "all"
      ? allMediaDocuments
      : allMediaDocuments.filter((d) => d.categoryId === categoryFilter);

  const viewingUrl = viewing ? mediaViewUrl(project.id, viewing) : null;

  function handleDelete(): void {
    if (!deleting) return;
    deleteDocument.mutate(
      { projectId: project.id, documentId: deleting.id },
      {
        onSuccess: () => {
          setDeleting(null);
          toast("Media deleted", "success");
        },
        onError: (err) => {
          setDeleting(null);
          const status = getApiErrorStatus(err);
          if (status !== 401 && status !== 403) toast(getApiErrorMessage(err), "error");
        },
      },
    );
  }

  return (
    <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
      <PageHeader
        title="Media Library"
        description="Site photos and videos captured in the field."
        actions={
          canManage ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => uploader.handleOpenChange(true)}
              className="h-[32px] cursor-pointer hover:bg-primary text-[13px] font-semibold px-[20px] py-[12px]"
            >
              <ReactSVG src={icons.upload} />
              Upload media
            </Button>
          ) : undefined
        }
      />

      <UploadDocumentDialog
        open={uploader.open}
        onOpenChange={uploader.handleOpenChange}
        categories={mediaCategories}
        isSubmitting={uploader.isUploading}
        progress={uploader.progress}
        error={uploader.error}
        onSubmit={uploader.upload}
      />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <FilterChip
          label="All"
          count={allMediaDocuments.length}
          active={categoryFilter === "all"}
          onClick={() => setCategoryFilter("all")}
        />
        {mediaCategories.map((category) => (
          <CategoryFilterChip
            key={category.id}
            category={category}
            documents={allMediaDocuments}
            active={categoryFilter === category.id}
            onClick={() => setCategoryFilter(category.id)}
          />
        ))}
      </div>

      <section className="mt-6">
        {mediaDocuments.length === 0 ? (
          <Card padding="lg" className="border border-dashed border-[#D9D9D9] bg-[#FAFAFA] text-center shadow-none">
            <p className="text-sm font-medium text-gray-900">No media yet</p>
            <p className="mt-1 text-xs text-gray-500">
              Photos and videos uploaded from site will appear here.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {mediaDocuments.map((doc) => (
              <MediaTile
                key={doc.id}
                doc={doc}
                url={mediaViewUrl(project.id, doc)}
                canManage={canManage}
                onView={() => setViewing(doc)}
                onDelete={() => setDeleting(doc)}
              />
            ))}
          </div>
        )}
      </section>

      {viewing && viewingUrl && (
        <FileViewerDialog
          open
          onOpenChange={(next) => {
            if (!next) setViewing(null);
          }}
          title={viewing.fileName}
          fileName={viewing.fileName}
          url={viewingUrl}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => {
          if (!next) setDeleting(null);
        }}
        onConfirm={handleDelete}
        loading={deleteDocument.isPending}
        title="Delete media"
        description="This permanently removes the file. This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

function CategoryFilterChip({
  category,
  documents,
  active,
  onClick,
}: {
  category: DocumentCategory;
  documents: ProjectDocument[];
  active: boolean;
  onClick: () => void;
}) {
  const count = documents.filter((d) => d.categoryId === category.id).length;
  return <FilterChip label={category.name} count={count} active={active} onClick={onClick} />;
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-primary-600 bg-primary-50 text-primary-700"
          : "border-[#EDEDED] bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900",
      )}
    >
      {label}
      <span className={cn("ml-1.5 tabular-nums", active ? "text-primary-600" : "text-gray-400")}>
        {count}
      </span>
    </button>
  );
}

function MediaTile({
  doc,
  url,
  canManage,
  onView,
  onDelete,
}: {
  doc: ProjectDocument;
  url: string | null;
  canManage: boolean;
  onView: () => void;
  onDelete: () => void;
}) {
  const ext = fileExt(doc.fileName);
  const isImage = IMAGE_EXTS.has(ext) && url !== null;
  const isVideo = VIDEO_EXTS.has(ext);

  return (
    <div className="group relative overflow-hidden rounded-xl border border-[#EDEDED] bg-white">
      <button
        type="button"
        onClick={onView}
        disabled={url === null}
        aria-label={`View ${doc.fileName}`}
        className="block w-full cursor-pointer disabled:cursor-default"
      >
        <div className="flex aspect-square w-full items-center justify-center overflow-hidden bg-[#F6F6F6]">
          {isImage ? (
            <img
              src={url}
              alt={doc.fileName}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
            />
          ) : isVideo ? (
            <div className="flex h-full w-full items-center justify-center bg-gray-900">
              <span className="flex size-12 items-center justify-center rounded-full bg-white/20 text-white">
                <PlayIcon className="size-5" />
              </span>
            </div>
          ) : (
            <ReactSVG src={icons.doc} />
          )}
        </div>
      </button>

      <div className="px-3 py-2.5">
        <p className="truncate text-xs font-medium text-gray-900">{doc.fileName}</p>
        <p className="truncate text-[11px] text-gray-500">
          {doc.category} · {formatShortDate(doc.uploadedAt) || doc.uploadedAt}
        </p>
      </div>

      {canManage && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${doc.fileName}`}
          className={cn(
            "absolute right-2 top-2 hidden size-7 items-center justify-center rounded-md",
            "bg-white/90 text-gray-500 shadow-sm hover:text-red-600 group-hover:flex",
          )}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 2l8 8M10 2l-8 8" />
          </svg>
        </button>
      )}
    </div>
  );
}
