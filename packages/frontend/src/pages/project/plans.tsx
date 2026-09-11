import { useState } from "react";
import { useNavigate } from "react-router-dom";
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

export default function ProjectPlans() {
  const { project, access } = useProjectContext();
  const navigate = useNavigate();
  const canManage = Boolean(access && canResourceAction(access, "documents", "upload"));
  const { data: categories = [] } = useProjectDocumentCategories(project.id);
  const { data: documents = [] } = useProjectDocuments(project.id);
  const uploader = useDocumentUpload(project.id, "Plan uploaded");
  const [filters, setFilters] = useState(EMPTY_DOCUMENT_FILTERS);

  const planCategories = categories.filter((c) => c.group === "plan");
  const planDocuments = documents.filter((d) => d.group === "plan");

  const visible = applyDocumentFilters(planDocuments, filters);

  return (
    <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
      <PageHeader
        title="Plans"
        actions={
          canManage ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => uploader.handleOpenChange(true)}
              className="h-[32px] cursor-pointer hover:bg-primary text-[13px] font-semibold px-[20px] py-[12px]"
            >
              <ReactSVG src={icons.upload} />
              Upload plan
            </Button>
          ) : undefined
        }
      />

      <UploadDocumentDialog
        open={uploader.open}
        onOpenChange={uploader.handleOpenChange}
        categories={planCategories}
        isSubmitting={uploader.isUploading}
        progress={uploader.progress}
        error={uploader.error}
        onSubmit={uploader.upload}
      />

      <DocumentFilterBar
        filters={filters}
        onChange={setFilters}
        categories={planCategories}
        searchPlaceholder="Search plans by name or category"
      />

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Plans & Drawings</h2>
          <p className="text-xs text-gray-500">
            {visible.length} of {planDocuments.length} plan{planDocuments.length === 1 ? "" : "s"}
          </p>
        </div>

        <DocumentsTable
          documents={visible}
          emptyMessage={planDocuments.length > 0 ? "No plans match these filters." : "No plans uploaded yet."}
          projectId={project.id}
          categories={planCategories}
          canManage={canManage}
          onOpenDocument={(doc) => navigate(`/project/${project.id}/plans/review?sheet=${doc.id}`)}
        />
      </section>
    </div>
  );
}
