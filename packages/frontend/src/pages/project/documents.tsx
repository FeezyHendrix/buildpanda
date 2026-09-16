import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { UploadDocumentDialog } from "@/components/molecules/upload-document-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import { useSetPageTitle } from "@/contexts/page-title-context";
import {
  useCreateDocument,
  useProjectDocumentCategories,
  useProjectDocuments,
} from "@/hooks/use-documents";
import { useUploadFile } from "@/hooks/use-files";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { canResourceAction } from "@/lib/project-types";
import type { CategoryGroup } from "@/lib/project-types";
import { CategoryMetricsCard } from "./documents/category-metrics-card";
import { DocumentsTable } from "./documents/documents-table";
import { Upload } from "lucide-react";

export default function ProjectDocuments() {
  const { project, access } = useProjectContext();
  const canManage = Boolean(access && canResourceAction(access, "documents", "upload"));
  const { data: categories = [] } = useProjectDocumentCategories(project.id);
  const { data: documents = [] } = useProjectDocuments(project.id);

  const [tab, setTab] = useState<CategoryGroup>("document");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const uploadFile = useUploadFile();
  const createDocument = useCreateDocument();

  // Frontend-only category mock until POST /document-categories lands
  // (see docs/documents-add-category-backend.md). Locally added categories
  // aren't persisted and reset on reload.
  const [localCategories, setLocalCategories] = useState<
    Array<{ id: string; name: string; group: CategoryGroup }>
  >([]);

  function handleCreateCategory(name: string): string {
    const id = `local-${Date.now()}`;
    setLocalCategories((prev) => [...prev, { id, name, group: tab }]);
    return id;
  }

  const isPlans = tab === "plan";

  useSetPageTitle(
    "Documents",
    isPlans
      ? "Drawings and schematics with full revision history."
      : "Secure, centralized management for project compliance.",
  );

  const visibleCategories = [
    ...categories.filter((c) => c.group === tab),
    ...localCategories
      .filter((c) => c.group === tab)
      .map((c) => ({ id: c.id, name: c.name, fileCount: 0, totalSize: "0 MB", tone: "brand" as const, group: c.group })),
  ];
  const visibleDocuments = documents.filter((d) => d.group === tab);
  const isUploading = uploadFile.isPending || createDocument.isPending;
  const uploadError = uploadFile.error
    ? getApiErrorMessage(uploadFile.error)
    : createDocument.error
      ? getApiErrorMessage(createDocument.error)
      : null;

  function notifyUploadError(err: unknown): void {
    const status = getApiErrorStatus(err);
    if (status === 401 || status === 403) return;
    toast(getApiErrorMessage(err), "error");
  }

  function handleUploadOpenChange(next: boolean): void {
    if (!next && isUploading) return;
    if (!next) setUploadProgress(null);
    setUploadOpen(next);
  }

  function handleUpload(input: { categoryId: string; file: File }): void {
    setUploadProgress(0);
    uploadFile.mutate(
      { file: input.file, onProgress: setUploadProgress },
      {
        onSuccess: (uploaded) => {
          createDocument.mutate(
            {
              projectId: project.id,
              categoryId: input.categoryId,
              fileId: uploaded.id,
            },
            {
              onSuccess: () => {
                setUploadOpen(false);
                setUploadProgress(null);
                toast("Document uploaded", "success");
              },
              onError: (err) => {
                setUploadProgress(null);
                notifyUploadError(err);
              },
            },
          );
        },
        onError: (err) => {
          setUploadProgress(null);
          notifyUploadError(err);
        },
      },
    );
  }

  return (
    <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
      {/* Tabs + upload action */}
      <div className="flex items-center justify-between">
        <div className="inline-flex border border-[#EDEDED] bg-[#F6F6F6] p-0.5">
          {(["document", "plan"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setTab(g)}
              className={cn(
                "px-4 py-1.5 text-sm font-medium transition-colors",
                tab === g
                  ? "bg-white text-[#111827] shadow-sm"
                  : "text-[#6B7280] hover:text-[#111827]",
              )}
            >
              {g === "document" ? "Documents" : "Project Plans"}
            </button>
          ))}
        </div>

        {canManage && (
          <Button
            variant="primary"
            size="lg"
            onClick={() => setUploadOpen(true)}
            className="gap-2 font-semibold"
          >
            <Upload className="size-5" />
            {isPlans ? "Upload Plan" : "Upload Document"}
          </Button>
        )}
      </div>

      <UploadDocumentDialog
        open={uploadOpen}
        onOpenChange={handleUploadOpenChange}
        categories={visibleCategories}
        isSubmitting={isUploading}
        progress={uploadProgress}
        error={uploadError}
        onSubmit={handleUpload}
        onCreateCategory={handleCreateCategory}
      />

      <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {visibleCategories.map((category, index) => (
          <CategoryMetricsCard key={category.id} category={category} index={index} />
        ))}
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-base font-semibold text-[#111827]">
          {isPlans ? "Plans & Drawings" : "Recent Documents"}
        </h2>

        <DocumentsTable
          documents={visibleDocuments}
          projectId={project.id}
          categories={visibleCategories}
          canManage={canManage}
        />
      </section>
    </div>
  );
}
