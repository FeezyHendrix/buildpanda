import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { IconBox } from "@/components/atoms/icon-box";
import {
  DocumentsIcon,
  PlusIcon,
} from "@/components/atoms/project-nav-icons";
import { PageHeader } from "@/components/molecules/page-header";
import { UploadDocumentDialog } from "@/components/molecules/upload-document-dialog";
import {
  UpsertDocumentDialog,
  type UpsertDocumentValues,
} from "@/components/molecules/upsert-document-dialog";
import { DocumentVersionsDialog } from "@/components/molecules/document-versions-dialog";
import { FileViewerDialog } from "@/components/molecules/file-viewer-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import {
  documentVersionViewUrl,
  useCreateDocument,
  useDeleteDocument,
  useEditDocument,
  useProjectDocumentCategories,
  useProjectDocuments,
} from "@/hooks/use-documents";
import { useUploadFile } from "@/hooks/use-files";
import { DOCUMENT_STATUS_TONE } from "@/lib/project-meta";
import { cn } from "@/lib/utils";
import type {
  CategoryGroup,
  DocumentCategory,
  ProjectDocument,
} from "@/lib/project-mock-data";

export default function ProjectDocuments() {
  const { project } = useProjectContext();
  const { data: categories = [] } = useProjectDocumentCategories(project.id);
  const { data: documents = [] } = useProjectDocuments(project.id);

  const [tab, setTab] = useState<CategoryGroup>("document");
  const [uploadOpen, setUploadOpen] = useState(false);
  const uploadFile = useUploadFile();
  const createDocument = useCreateDocument();

  const visibleCategories = categories.filter((c) => c.group === tab);
  const visibleDocuments = documents.filter((d) => d.group === tab);
  const isPlans = tab === "plan";
  const isUploading = uploadFile.isPending || createDocument.isPending;
  const uploadError =
    (uploadFile.error as Error | undefined)?.message ??
    (createDocument.error as Error | undefined)?.message ??
    null;

  function handleUpload(input: { categoryId: string; file: File }): void {
    uploadFile.mutate(input.file, {
      onSuccess: (uploaded) => {
        createDocument.mutate(
          {
            projectId: project.id,
            categoryId: input.categoryId,
            fileId: uploaded.id,
          },
          { onSuccess: () => setUploadOpen(false) },
        );
      },
    });
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-10">
      <PageHeader
        title="Documents"
        description={
          isPlans
            ? "Drawings and schematics with full revision history."
            : "Secure, centralized management for project compliance."
        }
        actions={
          <Button
            variant="primary"
            size="md"
            onClick={() => setUploadOpen(true)}
          >
            <PlusIcon className="size-4" />
            {isPlans ? "Upload plan" : "Upload document"}
          </Button>
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
        onOpenChange={setUploadOpen}
        categories={visibleCategories}
        isSubmitting={isUploading}
        error={uploadError}
        onSubmit={handleUpload}
      />

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleCategories.map((category) => (
          <CategoryCard key={category.id} category={category} />
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
        />
      </section>
    </div>
  );
}

function CategoryCard({ category }: { category: DocumentCategory }) {
  return (
    <Card padding="md" interactive>
      <div className="flex items-start gap-3">
        <IconBox
          tone={category.tone}
          size="md"
          icon={<DocumentsIcon className="size-5" />}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">
            {category.name}
          </p>
          <p className="mt-1 text-xs tabular-nums text-gray-500">
            {category.fileCount} Files · {category.totalSize}
          </p>
        </div>
      </div>
    </Card>
  );
}

function DocumentsTable({
  documents,
  projectId,
  categories,
}: {
  documents: ProjectDocument[];
  projectId: string;
  categories: DocumentCategory[];
}) {
  return (
    <Card padding="none" className="overflow-hidden">
      <table className="w-full text-left">
        <thead className="border-b border-[#EDEDED] bg-[#FAFAFA]">
          <tr>
            <TableHeader>File Name</TableHeader>
            <TableHeader>Category</TableHeader>
            <TableHeader>Date Uploaded</TableHeader>
            <TableHeader className="pr-6 text-right">Status</TableHeader>
          </tr>
        </thead>
        <tbody>
          {documents.length === 0 ? (
            <tr>
              <td
                colSpan={4}
                className="px-6 py-10 text-center text-sm text-gray-500"
              >
                No documents uploaded yet.
              </td>
            </tr>
          ) : (
            documents.map((doc, idx) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                isLast={idx === documents.length - 1}
                projectId={projectId}
                categories={categories}
              />
            ))
          )}
        </tbody>
      </table>
    </Card>
  );
}

function DocumentRow({
  doc,
  isLast,
  projectId,
  categories,
}: {
  doc: ProjectDocument;
  isLast: boolean;
  projectId: string;
  categories: DocumentCategory[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const editDocument = useEditDocument();
  const deleteDocument = useDeleteDocument();

  const categoryId = doc.categoryId ?? categories.find((c) => c.name === doc.category)?.id ?? "";

  function handleEdit(values: UpsertDocumentValues): void {
    editDocument.mutate(
      { projectId, documentId: doc.id, categoryId: values.categoryId },
      { onSuccess: () => setEditOpen(false) },
    );
  }

  function handleDelete(): void {
    deleteDocument.mutate({ projectId, documentId: doc.id });
  }

  return (
    <>
      <tr className={isLast ? undefined : "border-b border-[#F0F0F0]"}>
        <TableCell>
          <div className="flex items-center gap-3">
            <IconBox
              tone="gray"
              size="sm"
              icon={<DocumentsIcon className="size-4" />}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">
                {doc.fileName}
              </p>
              <p className="text-xs text-gray-500">
                {doc.size}
                {doc.versionNo > 0 ? ` · v${doc.versionNo}` : ""}
              </p>
            </div>
          </div>
        </TableCell>
        <TableCell className="text-sm text-gray-600">{doc.category}</TableCell>
        <TableCell className="whitespace-nowrap text-sm text-gray-600">
          {doc.uploadedAt}
        </TableCell>
        <TableCell className="pr-6 text-right">
          <div className="flex items-center justify-end gap-3">
            <Badge tone={DOCUMENT_STATUS_TONE[doc.status]} size="md" dot>
              {doc.status}
            </Badge>
            {doc.currentVersionId && (
              <button
                type="button"
                onClick={() => setViewerOpen(true)}
                className="text-xs font-medium text-[#004DE7] hover:text-[#0041c4]"
              >
                View
              </button>
            )}
            <button
              type="button"
              onClick={() => setVersionsOpen(true)}
              className="text-xs font-medium text-gray-500 hover:text-gray-900"
            >
              Versions{doc.versionCount > 1 ? ` (${doc.versionCount})` : ""}
            </button>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="text-xs font-medium text-gray-500 hover:text-gray-900"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="text-xs font-medium text-red-500 hover:text-red-600"
            >
              Delete
            </button>
          </div>
        </TableCell>
      </tr>

      <UpsertDocumentDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        projectId={projectId}
        mode="edit"
        initial={{
          categoryId,
        }}
        onSubmit={handleEdit}
        isSubmitting={editDocument.isPending}
        error={(editDocument.error as Error | undefined)?.message ?? null}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        title="Delete document"
        description="This permanently removes the document. This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />

      <DocumentVersionsDialog
        open={versionsOpen}
        onOpenChange={setVersionsOpen}
        projectId={projectId}
        document={doc}
      />

      {doc.currentVersionId && (
        <FileViewerDialog
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          title={doc.fileName}
          fileName={doc.fileName}
          url={documentVersionViewUrl(projectId, doc.id, doc.currentVersionId)}
        />
      )}
    </>
  );
}

function TableHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "px-6 py-3 text-xs font-medium uppercase tracking-wider text-gray-500",
        className,
      )}
    >
      {children}
    </th>
  );
}

function TableCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={cn("px-6 py-4", className)}>{children}</td>;
}
