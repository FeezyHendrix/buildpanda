import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { IconBox } from "@/components/atoms/icon-box";
import {
  DocumentsIcon,
  PlusIcon,
} from "@/components/atoms/project-nav-icons";
import { PageHeader } from "@/components/molecules/page-header";
import { UploadDocumentDialog } from "@/components/molecules/upload-document-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useCreateDocument,
  useProjectDocumentCategories,
  useProjectDocuments,
} from "@/hooks/use-documents";
import { useUploadFile } from "@/hooks/use-files";
import { DOCUMENT_STATUS_TONE } from "@/lib/project-meta";
import { cn } from "@/lib/utils";
import type {
  DocumentCategory,
  ProjectDocument,
} from "@/lib/project-mock-data";

export default function ProjectDocuments() {
  const { project } = useProjectContext();
  const { data: categories = [] } = useProjectDocumentCategories(project.id);
  const { data: documents = [] } = useProjectDocuments(project.id);

  const [uploadOpen, setUploadOpen] = useState(false);
  const uploadFile = useUploadFile();
  const createDocument = useCreateDocument();
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
        description="Secure, centralized management for project compliance."
        actions={
          <Button
            variant="primary"
            size="md"
            onClick={() => setUploadOpen(true)}
          >
            <PlusIcon className="size-4" />
            Upload document
          </Button>
        }
      />

      <UploadDocumentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        categories={categories}
        isSubmitting={isUploading}
        error={uploadError}
        onSubmit={handleUpload}
      />

      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <CategoryCard key={category.id} category={category} />
        ))}
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            Recent Documents
          </h2>
          <p className="text-xs text-gray-500">
            Showing 1–{documents.length} of {documents.length} documents
          </p>
        </div>

        <DocumentsTable documents={documents} />
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

function DocumentsTable({ documents }: { documents: ProjectDocument[] }) {
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
}: {
  doc: ProjectDocument;
  isLast: boolean;
}) {
  return (
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
            <p className="text-xs text-gray-500">{doc.size}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-sm text-gray-600">{doc.category}</TableCell>
      <TableCell className="whitespace-nowrap text-sm text-gray-600">
        {doc.uploadedAt}
      </TableCell>
      <TableCell className="pr-6 text-right">
        <Badge tone={DOCUMENT_STATUS_TONE[doc.status]} size="md" dot>
          {doc.status}
        </Badge>
      </TableCell>
    </tr>
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
