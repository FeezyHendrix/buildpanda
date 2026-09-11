import { useState } from "react";
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
import {
  applyDocumentFilters,
  DocumentFilterBar,
  EMPTY_DOCUMENT_FILTERS,
} from "./documents/document-filter-bar";
import { DocumentsTable } from "./documents/documents-table";
import { useDocumentUpload } from "./documents/use-document-upload";

export default function ProjectDocuments() {
  const { project, access } = useProjectContext();
  const canManage = Boolean(access && canResourceAction(access, "documents", "upload"));
  const { data: categories = [] } = useProjectDocumentCategories(project.id);
  const { data: documents = [] } = useProjectDocuments(project.id);
  const uploader = useDocumentUpload(project.id, "Document uploaded");
  const [filters, setFilters] = useState(EMPTY_DOCUMENT_FILTERS);

  // Everything that is not a drawing or a media file belongs here: a contract
  // or a proposal snapshot has its own group and must not vanish from the app.
  const filed = (group: string) => group !== "plan" && group !== "media";
  const visibleCategories = categories.filter((c) => filed(c.group));
  const visibleDocuments = documents.filter((d) => filed(d.group));

  const visible = applyDocumentFilters(visibleDocuments, filters);

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

      <DocumentFilterBar
        filters={filters}
        onChange={setFilters}
        categories={visibleCategories}
        searchPlaceholder="Search documents by name or category"
      />

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Recent Documents</h2>
          <p className="text-xs text-gray-500">
            {visible.length} of {visibleDocuments.length} document{visibleDocuments.length === 1 ? "" : "s"}
          </p>
        </div>

        <DocumentsTable
          documents={visible}
          emptyMessage={visibleDocuments.length > 0 ? "No documents match these filters." : "No documents uploaded yet."}
          projectId={project.id}
          categories={visibleCategories}
          canManage={canManage}
        />
      </section>
    </div>
  );
}
