import { useState } from "react";
import { ReactSVG } from "react-svg";
import { Badge } from "@/components/atoms/badge";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { icons } from "@/assets/icons/icons";
import {
  UpsertDocumentDialog,
  type UpsertDocumentValues,
} from "@/components/molecules/upsert-document-dialog";
import { DocumentVersionsDialog } from "@/components/molecules/document-versions-dialog";
import { FileViewerDialog } from "@/components/molecules/file-viewer-dialog";
import {
  documentVersionViewUrl,
  useCreateShare,
  useDeleteDocument,
  useEditDocument,
} from "@/hooks/use-documents";
import { DOCUMENT_STATUS_TONE } from "@/lib/project-meta";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type {
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

export function DocumentsTable({
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

