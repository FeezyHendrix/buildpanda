import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Info, Plus } from "lucide-react";
import { ReactSVG } from "react-svg";
import { icons2 } from "@/assets/icons2/icon2";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { Spinner } from "@/components/atoms/spinner";
import { TextInput } from "@/components/atoms/text-input";
import { EmptyState } from "@/components/molecules/empty-state";
import { UpsertSupplierDialog } from "@/components/molecules/upsert-supplier-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import { useSetPageTitle } from "@/contexts/page-title-context";
import {
  useCreateSupplier,
  useDeleteSupplier,
  useSuppliers,
  useUpdateSupplier,
  type SupplierInput,
} from "@/hooks/use-suppliers";
import { cn } from "@/lib/utils";
import { canResourceAction } from "@/lib/project-types";
import type { Supplier } from "@/lib/project-types";
import { toast } from "@/lib/toast";

const PAGE_SIZE = 10;

function pageNumbers(page: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const window = [page - 1, page, page + 1].filter((n) => n > 1 && n < totalPages);
  const pages = new Set([1, totalPages, ...window]);
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1]! > 1) out.push("…");
    out.push(n);
  });
  return out;
}

export default function ProjectSuppliers() {
  useSetPageTitle(
    "Suppliers",
    "Your directory of material and equipment suppliers for this project.",
  );

  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "materials", "manage");
  const { data: suppliers = [], isLoading } = useSuppliers(project.id);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const deleteSupplier = useDeleteSupplier();

  useEffect(() => {
    setPage(1);
  }, [search]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((supplier) =>
      [supplier.name, supplier.contactName ?? "", supplier.email ?? "", supplier.phone ?? ""].some(
        (field) => field.toLowerCase().includes(q),
      ),
    );
  }, [suppliers, search]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const showingFrom = visible.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(safePage * PAGE_SIZE, visible.length);

  function handleSubmit(values: SupplierInput): void {
    if (editTarget) {
      updateSupplier.mutate(
        { projectId: project.id, supplierId: editTarget.id, ...values },
        {
          onSuccess: () => {
            setFormOpen(false);
            setEditTarget(null);
            toast("Supplier updated", "success");
          },
          onError: () => toast("Could not update supplier"),
        },
      );
    } else {
      createSupplier.mutate(
        { projectId: project.id, ...values },
        {
          onSuccess: () => {
            setFormOpen(false);
            toast("Supplier added", "success");
          },
          onError: () => toast("Could not add supplier"),
        },
      );
    }
  }

  function openEdit(supplier: Supplier): void {
    setEditTarget(supplier);
    setFormOpen(true);
  }

  return (
    <div className="w-full px-4 py-6 lg:px-8">
      {canManage && (
        <div className="flex justify-end">
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              setEditTarget(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" />
            Add Supplier
          </Button>
        </div>
      )}

      <div className="relative mt-4 w-full sm:max-w-[320px]">
        <ReactSVG
          src={icons2.search}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 shrink-0 [&_svg]:size-[18px]"
        />
        <TextInput
          type="search"
          placeholder="Search suppliers"
          value={search}
          onChange={setSearch}
          aria-label="Search suppliers"
          className="h-9 w-full indent-8"
        />
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="flex justify-center border border-[#EBEBEB] bg-white py-16">
            <Spinner size="md" />
          </div>
        ) : visible.length === 0 ? (
          <div className="border border-[#EBEBEB] bg-white">
            <EmptyState
              title="No suppliers yet"
              description="Add the suppliers you work with to keep contact details and reorder policies in one place."
              action={
                canManage ? (
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => {
                      setEditTarget(null);
                      setFormOpen(true);
                    }}
                  >
                    <Plus className="size-4" />
                    Add supplier
                  </Button>
                ) : undefined
              }
              className="py-10"
            />
          </div>
        ) : (
          <>
            <div className="overflow-hidden border border-[#EBEBEB] bg-white">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] table-fixed text-left">
                  <colgroup>
                    <col className="w-[22%]" />
                    <col className="w-[24%]" />
                    <col className="w-[18%]" />
                    <col />
                    <col className="w-12" />
                  </colgroup>
                  <thead className="bg-[#F9FAFB]">
                    <tr className="border-b border-[#E5E7EB]">
                      <th className="px-4 py-3 text-[11px] font-medium text-[#6B7280]">Supplier</th>
                      <th className="px-3 py-3 text-[11px] font-medium text-[#6B7280]">
                        Contact Name
                      </th>
                      <th className="px-3 py-3 text-[11px] font-medium text-[#6B7280]">
                        Phone Number
                      </th>
                      <th className="px-3 py-3 text-[11px] font-medium text-[#6B7280]">Address</th>
                      <th className="px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F0F0] bg-white">
                    {paged.map((supplier) => (
                      <tr key={supplier.id} className="group hover:bg-[#FAFAFA]">
                        <td className="px-4 py-3.5">
                          <span className="block truncate text-sm font-medium text-[#111827]">
                            {supplier.name}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          <p className="truncate text-sm font-medium text-[#111827]">
                            {supplier.contactName || "—"}
                          </p>
                          {supplier.email && (
                            <p className="mt-0.5 truncate text-xs text-[#767676]">
                              {supplier.email}
                            </p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3.5 text-sm text-[#6B7280]">
                          {supplier.phone || "—"}
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="block truncate text-sm text-[#6B7280]">
                            {supplier.address || "—"}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => openEdit(supplier)}
                              aria-label={`View ${supplier.name}`}
                              className="flex size-7 items-center justify-center rounded-md text-[#9CA3AF] outline-none transition-colors hover:bg-[#F3F4F6] hover:text-[#111827]"
                            >
                              <Info className="size-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[#767676]">
                Showing {showingFrom} to {showingTo} of {visible.length} Suppliers
              </p>
              {totalPages > 1 && (
                <nav aria-label="Suppliers pages" className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Previous page"
                    disabled={safePage === 1}
                    onClick={() => setPage(safePage - 1)}
                    className="flex size-7 items-center justify-center rounded-full text-[#1E1E1E] outline-none transition-colors hover:bg-[#F5F5F5] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  {pageNumbers(safePage, totalPages).map((n, i) =>
                    n === "…" ? (
                      <span key={`gap-${i}`} className="px-1 text-xs text-[#9CA3AF]">
                        …
                      </span>
                    ) : (
                      <button
                        key={n}
                        type="button"
                        aria-label={`Page ${n}`}
                        aria-current={n === safePage ? "page" : undefined}
                        onClick={() => setPage(n)}
                        className={cn(
                          "flex size-7 items-center justify-center rounded-full text-[13px] font-medium outline-none transition-colors",
                          n === safePage
                            ? "bg-[#1E1E1E] text-white"
                            : "text-[#1E1E1E] hover:bg-[#F5F5F5]",
                        )}
                      >
                        {n}
                      </button>
                    ),
                  )}
                  <button
                    type="button"
                    aria-label="Next page"
                    disabled={safePage === totalPages}
                    onClick={() => setPage(safePage + 1)}
                    className="flex size-7 items-center justify-center rounded-full text-[#1E1E1E] outline-none transition-colors hover:bg-[#F5F5F5] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </nav>
              )}
            </div>
          </>
        )}
      </div>

      <UpsertSupplierDialog
        open={formOpen}
        onOpenChange={(next) => {
          setFormOpen(next);
          if (!next) setEditTarget(null);
        }}
        initial={editTarget}
        isSubmitting={createSupplier.isPending || updateSupplier.isPending}
        error={
          createSupplier.error
            ? (createSupplier.error as Error).message
            : updateSupplier.error
              ? (updateSupplier.error as Error).message
              : null
        }
        onSubmit={handleSubmit}
        onDelete={
          editTarget && canManage
            ? () => {
                setFormOpen(false);
                setDeleteTarget(editTarget);
              }
            : undefined
        }
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(next) => {
          if (!next) setDeleteTarget(null);
        }}
        title={`Delete ${deleteTarget?.name ?? "this supplier"}?`}
        description="This removes the supplier from your directory. Any material orders that referenced it by name are unaffected."
        variant="danger"
        confirmLabel="Delete"
        loading={deleteSupplier.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteSupplier.mutate(
            { projectId: project.id, supplierId: deleteTarget.id },
            {
              onSuccess: () => {
                setDeleteTarget(null);
                setEditTarget(null);
                toast("Supplier deleted", "success");
              },
              onError: () => toast("Could not delete supplier"),
            },
          );
        }}
      />
    </div>
  );
}
