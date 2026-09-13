import { useState } from "react";
import { ReactSVG } from "react-svg";
import { Badge } from "@/components/atoms/badge";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { DocumentsIcon } from "@/components/atoms/project-nav-icons";
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyRow,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/atoms/table";
import { icons } from "@/assets/icons/icons";
import {
  UpsertDocumentDialog,
  type UpsertDocumentValues,
} from "@/components/molecules/upsert-document-dialog";
import { DocumentVersionsDialog } from "@/components/molecules/document-versions-dialog";
import { EmptyState } from "@/components/molecules/empty-state";
import { FileViewerDialog } from "@/components/molecules/file-viewer-dialog";
import {
  documentVersionViewUrl,
  useCreateShare,
  useDeleteDocument,
  useEditDocument,
} from "@/hooks/use-documents";
import { DOCUMENT_STATUS_TONE } from "@/lib/project-meta";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api-error";
import { formatShortDate } from "@/lib/formatters";
import { toast } from "@/lib/toast";
import { RowActionsMenu, type RowActionItem } from "@/components/molecules/row-actions-menu";

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
  onOpenDocument,
  emptyMessage = "No documents uploaded yet.",
}: {
  documents: ProjectDocument[];
  projectId: string;
  categories: DocumentCategory[];
  canManage: boolean;
  onOpenDocument?: (doc: ProjectDocument) => void;
  /** Shown when there are no rows — the page says whether that is "none uploaded" or "none match". */
  emptyMessage?: string;
}) {
  return (
    <Card padding="none" className="overflow-hidden border-none">
      <Table className="min-w-[640px]">
        <TableHead>
          <tr>
            <TableHeaderCell>File Name</TableHeaderCell>
            <TableHeaderCell>Category</TableHeaderCell>
            <TableHeaderCell>Date Uploaded</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell align="right">Actions</TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {documents.length === 0 ? (
            <TableEmptyRow colSpan={5}>
              <EmptyState
                variant="inline"
                icon={<DocumentsIcon />}
                title={emptyMessage.replace(/\.$/, "")}
              />
            </TableEmptyRow>
          ) : (
            documents.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                projectId={projectId}
                categories={categories}
                canManage={canManage}
                onOpenDocument={onOpenDocument}
              />
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

function DocumentRow({
  doc,
  projectId,
  categories,
  canManage,
  onOpenDocument,
}: {
  doc: ProjectDocument;
  projectId: string;
  categories: DocumentCategory[];
  canManage: boolean;
  onOpenDocument?: (doc: ProjectDocument) => void;
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
      <TableRow>
        <TableCell>
          <div className="flex items-center gap-3">
            <ReactSVG src={getFileTypeIcon(doc.fileName)} className="shrink-0" />
            {onOpenDocument ? (
              <button
                type="button"
                onClick={() => onOpenDocument(doc)}
                title={`Open ${doc.fileName} in the review workspace`}
                className="group min-w-0 text-left outline-none focus-visible:shadow-focus"
              >
                <p className="truncate text-sm font-medium text-gray-900 group-hover:text-primary-600 group-hover:underline">
                  {doc.fileName}
                </p>
                <p className="text-xs text-gray-500">
                  {doc.size}
                  {doc.versionNo > 0 ? ` · v${doc.versionNo}` : ""}
                </p>
              </button>
            ) : (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">
                  {doc.fileName}
                </p>
                <p className="text-xs text-gray-500">
                  {doc.size}
                  {doc.versionNo > 0 ? ` · v${doc.versionNo}` : ""}
                </p>
              </div>
            )}
          </div>
        </TableCell>
        <TableCell className="text-gray-600">{doc.category}</TableCell>
        <TableCell className="whitespace-nowrap text-gray-600">
          {formatShortDate(doc.uploadedAt) || doc.uploadedAt}
        </TableCell>
        <TableCell>
          <Badge tone={DOCUMENT_STATUS_TONE[doc.status]} size="md" className="flex w-fit items-center gap-1.5 bg-transparent">
            <ReactSVG src={getStatusIcon(doc.status)} className="shrink-0" />
            <p>{doc.status}</p>
          </Badge>
        </TableCell>
        <TableCell>
          <RowMenu
            doc={doc}
            canManage={canManage}
            shareCopied={shareCopied}
            onOpen={onOpenDocument ? () => onOpenDocument(doc) : undefined}
            onView={() => setViewerOpen(true)}
            onShare={handleShare}
            onVersions={() => setVersionsOpen(true)}
            onEdit={() => setEditOpen(true)}
            onDelete={() => setDeleteOpen(true)}
          />
        </TableCell>
      </TableRow>

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

function RowMenu({
  doc,
  canManage,
  shareCopied,
  onOpen,
  onView,
  onShare,
  onVersions,
  onEdit,
  onDelete,
}: {
  doc: ProjectDocument;
  canManage: boolean;
  shareCopied: boolean;
  onOpen?: () => void;
  onView: () => void;
  onShare: () => void;
  onVersions: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  // A plan opens in the review workspace, a document in the viewer: one
  // "View" either way, never a choice between two ways to look at the same file.
  const view = onOpen ?? (doc.currentVersionId ? onView : null);
  const items: RowActionItem[] = [
    ...(view ? [{ label: "View", onSelect: view }] : []),
    ...(doc.currentVersionId ? [{ label: shareCopied ? "Copied!" : "Share", onSelect: onShare }] : []),
    { label: `Versions${doc.versionCount > 1 ? ` (${doc.versionCount})` : ""}`, onSelect: onVersions },
    ...(canManage
      ? [
          { label: "Edit", onSelect: onEdit },
          { label: "Delete", onSelect: onDelete, tone: "danger" as const },
        ]
      : []),
  ];

  return (
    <div className="flex items-center justify-end">
      <RowActionsMenu ariaLabel="Actions" items={items} />
    </div>
  );
}
