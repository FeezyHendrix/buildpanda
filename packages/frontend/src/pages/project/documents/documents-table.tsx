import { useEffect, useRef, useState } from "react";
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
import { formatShortDate } from "@/lib/formatters";
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
      <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left">
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
      </div>
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
          {formatShortDate(doc.uploadedAt) || doc.uploadedAt}
        </TableCell>
        <TableCell>
          <Badge tone={DOCUMENT_STATUS_TONE[doc.status]} size="md" className="flex w-fit items-center gap-1.5 bg-transparent">
            <ReactSVG src={getStatusIcon(doc.status)} className="shrink-0" />
            <p>{doc.status}</p>
          </Badge>
        </TableCell>
        <TableCell className="pr-6">
          <RowMenu
            doc={doc}
            canManage={canManage}
            shareCopied={shareCopied}
            onView={() => setViewerOpen(true)}
            onShare={handleShare}
            onVersions={() => setVersionsOpen(true)}
            onEdit={() => setEditOpen(true)}
            onDelete={() => setDeleteOpen(true)}
          />
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

function RowMenu({
  doc,
  canManage,
  shareCopied,
  onView,
  onShare,
  onVersions,
  onEdit,
  onDelete,
}: {
  doc: ProjectDocument;
  canManage: boolean;
  shareCopied: boolean;
  onView: () => void;
  onShare: () => void;
  onVersions: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = menuPos !== null;

  useEffect(() => {
    if (!open) return;
    const close = () => setMenuPos(null);
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || menuRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener("mousedown", handler);
    // The menu is fixed-positioned, so any scroll would detach it from its row.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", handler);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function toggleMenu(e: React.MouseEvent<HTMLButtonElement>): void {
    if (open) {
      setMenuPos(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
  }

  const itemCls = "flex w-full cursor-default select-none items-center rounded-lg px-3 py-2 text-sm text-gray-700 outline-none hover:bg-[#F6F6F6]";

  return (
    <div ref={ref} className="relative flex items-center justify-end">
      <button
        type="button"
        onClick={toggleMenu}
        className="flex items-center justify-center rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
        aria-label="Actions"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          style={{ top: menuPos.top, right: menuPos.right }}
          className="fixed z-50 min-w-[160px] rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-black/5"
        >
          {doc.currentVersionId && (
            <button type="button" className={itemCls} onClick={() => { setMenuPos(null); onView(); }}>View</button>
          )}
          {doc.currentVersionId && (
            <button type="button" className={itemCls} onClick={() => { setMenuPos(null); onShare(); }}>
              {shareCopied ? "Copied!" : "Share"}
            </button>
          )}
          <button type="button" className={itemCls} onClick={() => { setMenuPos(null); onVersions(); }}>
            Versions{doc.versionCount > 1 ? ` (${doc.versionCount})` : ""}
          </button>
          {canManage && (
            <>
              <button type="button" className={itemCls} onClick={() => { setMenuPos(null); onEdit(); }}>Edit</button>
              <button type="button" className={cn(itemCls, "text-red-600 hover:bg-red-50")} onClick={() => { setMenuPos(null); onDelete(); }}>Delete</button>
            </>
          )}
        </div>
      )}
    </div>
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

