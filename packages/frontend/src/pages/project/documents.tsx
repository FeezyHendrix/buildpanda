import { useState } from "react";
import { ReactSVG } from "react-svg";
import { Button } from "@/components/atoms/button";
import { icons } from "@/assets/icons/icons";
import { PageHeader } from "@/components/molecules/page-header";
import { UploadDocumentDialog } from "@/components/molecules/upload-document-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useCreateDocument,
  useProjectDocumentCategories,
  useProjectDocuments,
} from "@/hooks/use-documents";
import { useUploadFile } from "@/hooks/use-files";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { CategoryGroup } from "@/lib/project-types";
import { CategoryMetricsCard } from "./documents/category-metrics-card";
import { DocumentsTable } from "./documents/documents-table";

export default function ProjectDocuments() {
  const { project, access } = useProjectContext();
  const canManage = access?.capabilities?.canManage ?? false;
  const { data: categories = [] } = useProjectDocumentCategories(project.id);
  const { data: documents = [] } = useProjectDocuments(project.id);

  const [tab, setTab] = useState<CategoryGroup>("document");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const uploadFile = useUploadFile();
  const createDocument = useCreateDocument();

  const visibleCategories = categories.filter((c) => c.group === tab);
  const visibleDocuments = documents.filter((d) => d.group === tab);
  const isPlans = tab === "plan";
  const isUploading = uploadFile.isPending || createDocument.isPending;
  const uploadError = uploadFile.error
    ? getApiErrorMessage(uploadFile.error)
    : createDocument.error
      ? getApiErrorMessage(createDocument.error)
      : null;

  // 401/403 are already surfaced globally by the axios interceptor; toast the
  // rest so an upload failure is never silent.
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
    <div className="w-full px-6 py-8 sm:px-10">
      <PageHeader
        title="Documents"
        description={
          isPlans
            ? "Drawings and schematics with full revision history."
            : "Secure, centralized management for project compliance."
        }
        actions={
          canManage ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => setUploadOpen(true)}
              className="h-[32px] cursor-pointer hover:bg-primary text-[13px] font-semibold px-[20px] py-[12px]"
            >
              <ReactSVG src={icons.upload} />
              {isPlans ? "Upload plan" : "Upload document"}
            </Button>
          ) : undefined
        }
      />

      <div className="mt-6 inline-flex rounded-lg border border-[#EDEDED] bg-[#F6F6F6] p-1">
        {(["document", "plan"] as const).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setTab(g)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              tab === g
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-900",
            )}
          >
            {g === "document" ? "Documents" : "Plans"}
          </button>
        ))}
      </div>

      <UploadDocumentDialog
        open={uploadOpen}
        onOpenChange={handleUploadOpenChange}
        categories={visibleCategories}
        isSubmitting={isUploading}
        progress={uploadProgress}
        error={uploadError}
        onSubmit={handleUpload}
      />

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {visibleCategories.map((category) => (
          <CategoryMetricsCard key={category.id} category={category} />
        ))}
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            {isPlans ? "Plans & Drawings" : "Recent Documents"}
          </h2>
          <p className="text-xs text-gray-500">
            {visibleDocuments.length}{" "}
            {isPlans ? "plan" : "document"}
            {visibleDocuments.length === 1 ? "" : "s"}
          </p>
        </div>

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

