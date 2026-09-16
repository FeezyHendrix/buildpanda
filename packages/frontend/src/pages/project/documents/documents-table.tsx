import { useEffect, useRef, useState } from "react";
import { ReactSVG } from "react-svg";
import { Button } from "@/components/atoms/button";
import { Select } from "@/components/atoms/select";
import { TextInput } from "@/components/atoms/text-input";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/atoms/dropdown-menu";
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
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api-error";
import { formatShortDate } from "@/lib/formatters";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { DocumentCategory, ProjectDocument } from "@/lib/project-types";
import { icons } from "@/assets/icons/icons";
import { icons2 } from "@/assets/icons2/icon2";
import { Badge } from "@/components";

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "tiff", "svg"]);

function getFileTypeIcon(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (IMAGE_EXTS.has(ext)) return icons2.png;
  if (ext === "pdf") return icons2.pdf;
  if (ext === "xlsx" || ext === "xls") return icons2.xls;
  if (ext === "mov") return icons2.mov;
  if (ext === "txt") return icons2.txt;
  if (ext === "mp3") return icons2.mp3;
  return icons.doc;
}

type StatusFilter = "all" | "Verified" | "Pending" | "Expired";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "Verified", label: "Verified" },
  { value: "Pending", label: "Pending" },
  { value: "Expired", label: "Expired" },
];

function StatusBadge({ status }: { status: string }) {
  if (status === "Verified")
    return (
      <Badge tone="success" size="md">
        Verified
      </Badge>
    );
  if (status === "Expired")
    return (
      <Badge tone="danger" size="md">
        Expired
      </Badge>
    );
  return (
    <Badge tone="neutral" variant='outline' size="md">
      Pending
    </Badge>
  );
}

function DateFilterPopup({
  dateFrom,
  dateTo,
  onApply,
}: {
  dateFrom: string;
  dateTo: string;
  onApply: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(dateFrom);
  const [draftTo, setDraftTo] = useState(dateTo);
  const ref = useRef<HTMLDivElement>(null);
  const hasFilter = Boolean(dateFrom || dateTo);

  useEffect(() => {
    if (open) {
      setDraftFrom(dateFrom);
      setDraftTo(dateTo);
    }
  }, [open, dateFrom, dateTo]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  function apply(): void {
    onApply(draftFrom, draftTo);
    setOpen(false);
  }

  function reset(): void {
    setDraftFrom("");
    setDraftTo("");
    onApply("", "");
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Filter by date"
        className={cn(
          "flex h-10 items-center gap-2 border bg-white px-3 text-sm font-medium outline-none transition-colors",
          hasFilter
            ? "border-[#004DE7] text-[#004DE7]"
            : "border-[#EBEBEB] text-[#111827] hover:border-[#6B7280]",
        )}
      >
        <ReactSVG src={icons2.calendar} className="shrink-0 [&_svg]:size-[16px]" />
        Date
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[300px] border border-[#EBEBEB] bg-white p-5 shadow-xl">
          <p className="text-[16px] font-bold text-[#111827]">Filter by Date</p>

          <div className="mt-4 flex flex-col gap-1.5">
            <label
              htmlFor="doc-filter-from"
              className="text-[13px] font-medium text-[#1E1E1E]"
            >
              From
            </label>
            <div
              className="relative"
              onClick={(e) =>
                (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.showPicker?.()
              }
            >
              <TextInput
                id="doc-filter-from"
                type="date"
                placeholder="DD/MM/YY"
                value={draftFrom}
                onChange={setDraftFrom}
                aria-label="From date"
                className="h-11 w-full cursor-pointer pr-9 [&::-webkit-calendar-picker-indicator]:hidden"
                onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
              />
              <ReactSVG
                src={icons2.calendar}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 [&_svg]:size-[16px]"
              />
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-1.5">
            <label
              htmlFor="doc-filter-to"
              className="text-[13px] font-medium text-[#1E1E1E]"
            >
              To
            </label>
            <div
              className="relative"
              onClick={(e) =>
                (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.showPicker?.()
              }
            >
              <TextInput
                id="doc-filter-to"
                type="date"
                placeholder="DD/MM/YY"
                value={draftTo}
                onChange={setDraftTo}
                aria-label="To date"
                className="h-11 w-full cursor-pointer pr-9 [&::-webkit-calendar-picker-indicator]:hidden"
                onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
              />
              <ReactSVG
                src={icons2.calendar}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 [&_svg]:size-[16px]"
              />
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={apply}
            className="mt-4 h-11 w-full"
          >
            Apply Filter
          </Button>
          <button
            type="button"
            onClick={reset}
            className="mt-1 w-full py-1 text-center text-sm font-medium text-[#111827] outline-none hover:underline"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}

const PAGE_SIZE = 10;

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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const filtered = documents.filter((d) => {
    const matchSearch = !search || d.fileName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || d.status === statusFilter;
    const matchFrom = !dateFrom || (d.uploadedAt ?? "") >= dateFrom;
    const matchTo = !dateTo || (d.uploadedAt ?? "") <= dateTo;
    return matchSearch && matchStatus && matchFrom && matchTo;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageDocs = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const showFrom = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const showTo = Math.min(currentPage * PAGE_SIZE, total);

  function buildPageNumbers(): (number | "…")[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "…")[] = [1, 2, 3, 4];
    if (totalPages > 5) pages.push("…");
    pages.push(totalPages);
    return pages;
  }

  return (
    <div>
      {/* Search + filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-[340px]">
          <ReactSVG
            src={icons2.search}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 [&_svg]:size-[16px]"
          />
          <input
            type="search"
            placeholder="Search Documents"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-10 w-full border border-[#EBEBEB] bg-white pl-9 pr-3 text-sm text-[#111827] placeholder:text-[#9CA3AF] outline-none focus:border-[#6B7280]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date range */}
          <DateFilterPopup
            dateFrom={dateFrom}
            dateTo={dateTo}
            onApply={(from, to) => {
              setDateFrom(from);
              setDateTo(to);
              setPage(1);
            }}
          />

          {/* Status */}
          <Select
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(v) => { if (v) { setStatusFilter(v as StatusFilter); setPage(1); } }}
            placeholder="All Status"
            className="h-10 w-[140px]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden border border-[#EBEBEB] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left">
            <thead className="border-b border-[#EBEBEB] bg-[#FAFAFA]">
              <tr>
                <th className="px-6 py-3 text-xs font-semibold text-[#111827]">File Name</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#111827]">Category</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#111827]">Status</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#111827]">Date Uploaded</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F0]">
              {pageDocs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-[#9CA3AF]">
                    No documents found.
                  </td>
                </tr>
              ) : (
                pageDocs.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    doc={doc}
                    projectId={projectId}
                    categories={categories}
                    canManage={canManage}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-[#9CA3AF]">
          Showing {showFrom} to {showTo} of {total} Documents
        </p>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex size-8 items-center justify-center border border-[#EBEBEB] bg-white text-[#6B7280] hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            {buildPageNumbers().map((p, i) =>
              p === "…" ? (
                <span key={`ellipsis-${i}`} className="flex size-8 items-center justify-center text-sm text-[#9CA3AF]">…</span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={cn(
                    "flex size-8 items-center justify-center border text-sm",
                    currentPage === p
                      ? "border-[#004DE7] bg-[#004DE7] font-semibold text-white"
                      : "border-[#EBEBEB] bg-white text-[#374151] hover:bg-[#F9FAFB]",
                  )}
                >
                  {p}
                </button>
              ),
            )}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex size-8 items-center justify-center border border-[#EBEBEB] bg-white text-[#6B7280] hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DocumentRow({
  doc,
  projectId,
  categories,
  canManage,
}: {
  doc: ProjectDocument;
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
      <tr className="hover:bg-[#FAFAFA]">
        {/* File Name */}
        <td className="px-6 py-3.5">
          <div className="flex items-center gap-3">
            <ReactSVG src={getFileTypeIcon(doc.fileName)} className="shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[#111827]">{doc.fileName}</p>
              <p className="text-xs text-[#9CA3AF]">
                {doc.size}{doc.versionNo > 0 ? ` · v${doc.versionNo}` : ""}
              </p>
            </div>
          </div>
        </td>

        {/* Category */}
        <td className="px-6 py-3.5 text-sm text-[#6B7280]">{doc.category}</td>

        {/* Status */}
        <td className="px-6 py-3.5">
          <StatusBadge status={doc.status} />
        </td>

        {/* Date Uploaded */}
        <td className="whitespace-nowrap px-6 py-3.5 text-sm text-[#6B7280]">
          {formatShortDate(doc.uploadedAt) || "—"}
        </td>

        {/* Actions */}
        <td className="px-3 py-3.5">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="flex size-7 items-center justify-center rounded-full text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#374151]"
                  aria-label="Document actions"
                />
              }
            >
              {/* Info circle icon matching design */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[160px] p-1">
              {doc.currentVersionId && (
                <DropdownMenuItem
                  onSelect={() => setViewerOpen(true)}
                  className="text-[13px]"
                >
                  View
                </DropdownMenuItem>
              )}
              {doc.currentVersionId && (
                <DropdownMenuItem
                  onSelect={handleShare}
                  className="text-[13px]"
                >
                  {shareCopied ? "Copied!" : "Share"}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onSelect={() => setVersionsOpen(true)}
                className="text-[13px]"
              >
                Versions{doc.versionCount > 1 ? ` (${doc.versionCount})` : ""}
              </DropdownMenuItem>
              {canManage && (
                <>
                  <DropdownMenuItem
                    onSelect={() => setEditOpen(true)}
                    className="text-[13px]"
                  >
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    tone="danger"
                    onSelect={() => setDeleteOpen(true)}
                    className="text-[13px]"
                  >
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </td>
      </tr>

      <UpsertDocumentDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        projectId={projectId}
        mode="edit"
        initial={{ categoryId }}
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
          status={doc.status}
          fileSize={doc.size}
        />
      )}
    </>
  );
}
