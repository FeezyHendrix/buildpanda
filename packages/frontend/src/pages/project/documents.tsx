import { useState } from "react";
import { ReactSVG } from "react-svg";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { icons } from "@/assets/icons/icons";
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
  useCreateShare,
  useDeleteDocument,
  useEditDocument,
  useProjectDocumentCategories,
  useProjectDocuments,
} from "@/hooks/use-documents";
import { useUploadFile } from "@/hooks/use-files";
import { DOCUMENT_STATUS_TONE } from "@/lib/project-meta";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type {
  CategoryGroup,
  DocumentCategory,
  ProjectDocument,
} from "@/lib/project-types";

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "tiff", "svg"]);

function getFileTypeIcon(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (IMAGE_EXTS.has(ext)) return icons.jpg;
  if (ext === "pdf") return icons.pdf;
  // doc, docx, txt, csv, xlsx, xls, ppt, pptx, dwg, dxf, and anything else → doc icon
  return icons.doc;
}

const STATUS_ICON: Record<string, string> = {
  Verified: icons.verified,
  Pending: icons.pending,
  Expired: icons.expired,
};

function getStatusIcon(status: string): string {
  return STATUS_ICON[status] ?? icons.pending;
}

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

// ── Stubs: fill in values per category name when ready ────────────────────
const CATEGORY_ICON_STUBS: Record<string, string> = {
  "Land Documents": icons.folderBlue,
  "Architectural Plans": icons.note,
  "Contracts & Agreements": icons.hammer,
  "Invoices & Receipts": icons.receipt,
  "Government Approvals": icons.protect,
  "Inspection Certs": icons.clipboard,
};

const CATEGORY_BG: Record<string, string> = {
  "Land Documents": "bg-primary-50",
  "Architectural Plans": "bg-[#E0FFFC]",
  "Contracts & Agreements": "bg-[#FFF3DE]",
  "Invoices & Receipts": "bg-[#EDE2FF]",
  "Government Approvals": "bg-[#FFE6F0]",
  "Inspection Certs": "bg-[#DEEAFF]",
};

function CategoryMetricsCard({ category }: { category: DocumentCategory }) {
  const iconSrc = CATEGORY_ICON_STUBS[category.name] ?? "";
  const bgColor = CATEGORY_BG[category.name] ?? "bg-primary-50";

  return (
    <Card padding="md" interactive>
      <div className="flex flex-col gap-4">
        <div
          className={cn(
            "flex items-center justify-center w-[38px] h-[38px] rounded-[8px] p-[10px]",
            bgColor,
          )}
        >
          <ReactSVG src={iconSrc} />
        </div>
        <div className="min-w-0">
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
  canManage,
}: {
  documents: ProjectDocument[];
  projectId: string;
  categories: DocumentCategory[];
  canManage: boolean;
}) {
  return (
    <Card padding="none" className="overflow-hidden border-none">
      <table className="w-full text-left">
        <thead className="border-b border-[#EDEDED] bg-[#FAFAFA]">
          <tr>
            <TableHeader className="pr-6 font-semibold capitalize">File Name</TableHeader>
            <TableHeader className="pr-6 font-semibold capitalize">Category</TableHeader>
            <TableHeader className="pr-6  font-semibold capitalize">Date Uploaded</TableHeader>
            <TableHeader className="pr-6 font-semibold capitalize">Status</TableHeader>
            <TableHeader className="pr-6 text-right font-semibold capitalize">Actions</TableHeader>
          </tr>
        </thead>
        <tbody>
          {documents.length === 0 ? (
            <tr>
              <td
                colSpan={5}
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
                canManage={canManage}
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
  canManage,
}: {
  doc: ProjectDocument;
  isLast: boolean;
  projectId: string;
  categories: DocumentCategory[];
  canManage: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const editDocument = useEditDocument();
  const deleteDocument = useDeleteDocument();
  const createShare = useCreateShare();

  function handleShare(): void {
    createShare.mutate(
      { projectId, documentId: doc.id },
      {
        onSuccess: async (share) => {
          try {
            await navigator.clipboard.writeText(share.url);
            setShareCopied(true);
            setTimeout(() => setShareCopied(false), 2000);
            toast("Share link copied to clipboard", "success");
          } catch {
            toast(`Share link: ${share.url}`, "success");
          }
        },
        onError: () => toast("Could not create share link", "error"),
      },
    );
  }

  const categoryId = doc.categoryId ?? categories.find((c) => c.name === doc.category)?.id ?? "";

  function handleEdit(values: UpsertDocumentValues): void {
    editDocument.mutate(
      { projectId, documentId: doc.id, categoryId: values.categoryId },
      {
        onSuccess: () => {
          setEditOpen(false);
          toast("Document updated", "success");
        },
      },
    );
  }

  function handleDelete(): void {
    deleteDocument.mutate(
      { projectId, documentId: doc.id },
      {
        onSuccess: () => toast("Document deleted", "success"),
        onError: (err) => {
          const status = getApiErrorStatus(err);
          if (status !== 401 && status !== 403) toast(getApiErrorMessage(err), "error");
        },
      },
    );
  }

  return (
    <>
      <tr className={isLast ? undefined : "border-b border-[#F0F0F0]"}>
        <TableCell>
          <div className="flex items-center gap-3">
            <ReactSVG src={getFileTypeIcon(doc.fileName)} className="shrink-0" />
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
        <TableCell>
          <Badge tone={DOCUMENT_STATUS_TONE[doc.status]} size="md" className="flex w-fit items-center gap-1.5 bg-transparent">
            <ReactSVG src={getStatusIcon(doc.status)} className="shrink-0" />
            <p>{doc.status}</p>
          </Badge>
        </TableCell>
        <TableCell className="pr-6">
          <div className="flex items-center justify-end gap-3">
            {doc.currentVersionId && (
              <button
                type="button"
                onClick={() => setViewerOpen(true)}
                className="text-xs font-medium text-[#004DE7] hover:text-[#0041c4]"
              >
                View
              </button>
            )}
            {doc.currentVersionId && (
              <button
                type="button"
                onClick={handleShare}
                disabled={createShare.isPending}
                className="text-xs font-medium text-gray-500 hover:text-gray-900 disabled:opacity-50"
              >
                {shareCopied ? "Copied!" : "Share"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setVersionsOpen(true)}
              className="text-xs font-medium text-gray-500 hover:text-gray-900"
            >
              Versions{doc.versionCount > 1 ? ` (${doc.versionCount})` : ""}
            </button>
            {canManage && (
              <>
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
              </>
            )}
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
        error={editDocument.error ? getApiErrorMessage(editDocument.error) : null}
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
        canManage={canManage}
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
