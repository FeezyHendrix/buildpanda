import { ReactSVG } from "react-svg";
import { Button } from "@/components/atoms/button";
import { icons } from "@/assets/icons/icons";
import { PageHeader } from "@/components/molecules/page-header";
import { UploadDocumentDialog } from "@/components/molecules/upload-document-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useProjectDocumentCategories,
  useProjectDocuments,
} from "@/hooks/use-documents";
import { canResourceAction } from "@/lib/project-types";
import { CategoryMetricsCard } from "./documents/category-metrics-card";
import { DocumentsTable } from "./documents/documents-table";
import { useDocumentUpload } from "./documents/use-document-upload";

export default function ProjectDocuments() {
  const { project, access } = useProjectContext();
  const canManage = Boolean(access && canResourceAction(access, "documents", "upload"));
  const { data: categories = [] } = useProjectDocumentCategories(project.id);
  const { data: documents = [] } = useProjectDocuments(project.id);
  const uploader = useDocumentUpload(project.id, "Document uploaded");

  const visibleCategories = categories.filter((c) => c.group === "document");
  const visibleDocuments = documents.filter((d) => d.group === "document");

  return (
    <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
      <PageHeader
        title="Documents"
        description="Secure, centralized management for project compliance."
        actions={
          canManage ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => uploader.handleOpenChange(true)}
              className="h-[32px] cursor-pointer hover:bg-primary text-[13px] font-semibold px-[20px] py-[12px]"
            >
              <ReactSVG src={icons.upload} />
              Upload document
            </Button>
          ) : undefined
        }
      />

      <UploadDocumentDialog
        open={uploader.open}
        onOpenChange={uploader.handleOpenChange}
        categories={visibleCategories}
        isSubmitting={uploader.isUploading}
        progress={uploader.progress}
        error={uploader.error}
        onSubmit={uploader.upload}
      />

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {visibleCategories.map((category) => (
          <CategoryMetricsCard key={category.id} category={category} />
        ))}
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Recent Documents</h2>
          <p className="text-xs text-gray-500">
            {visibleDocuments.length} document{visibleDocuments.length === 1 ? "" : "s"}
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
