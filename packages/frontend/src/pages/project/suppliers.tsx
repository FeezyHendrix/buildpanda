import { useState } from "react";
import { CreateButton } from "@/components/molecules/create-button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { SearchInput } from "@/components/atoms/search-input";
import { PageHeader } from "@/components/molecules/page-header";
import { SimpleDropdown } from "@/components/molecules/simple-dropdown";
import { UpsertSupplierDialog } from "@/components/molecules/upsert-supplier-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useCreateSupplier,
  useDeleteSupplier,
  useSuppliers,
  useUpdateSupplier,
  type SupplierInput,
} from "@/hooks/use-suppliers";
import { canResourceAction } from "@/lib/project-types";
import type { Supplier } from "@/lib/project-types";
import { errorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { DuplicateSupplierNotice } from "./suppliers/duplicate-supplier-notice";
import { SuppliersTable } from "./suppliers/suppliers-table";
import {
  EMPTY_SUPPLIER_FILTERS,
  filterSuppliers,
  isFiltering,
  readDuplicate,
  supplierTrades,
  SUPPLIER_APPROVAL_OPTIONS,
  SUPPLIER_SCOPE_OPTIONS,
  type DuplicateSupplier,
  type SupplierApprovalFilter,
  type SupplierFilters,
  type SupplierScopeFilter,
} from "./suppliers/supplier-helpers";

/**
 * The supplier register. The list holds both the company-wide accounts and the
 * ones raised on this job, so the scope filter is how a PM tells them apart.
 */
export default function ProjectSuppliers() {
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "materials", "manage");
  const { data: suppliers = [], isLoading } = useSuppliers(project.id);

  const [filters, setFilters] = useState<SupplierFilters>(EMPTY_SUPPLIER_FILTERS);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

  const [duplicate, setDuplicate] = useState<DuplicateSupplier | null>(null);

  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const deleteSupplier = useDeleteSupplier();

  const tradeOptions = [
    { value: "all", label: "All trades" },
    ...supplierTrades(suppliers).map((trade) => ({ value: trade, label: trade })),
  ];
  const visible = filterSuppliers(suppliers, filters);

  function openCreate(): void {
    setEditTarget(null);
    setDuplicate(null);
    setFormOpen(true);
  }

  function openEdit(supplier: Supplier): void {
    setEditTarget(supplier);
    setDuplicate(null);
    setFormOpen(true);
  }

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
        },
      );
      return;
    }
    createSupplier.mutate(
      { projectId: project.id, ...values },
      {
        onSuccess: () => {
          setFormOpen(false);
          setDuplicate(null);
          toast("Supplier added", "success");
        },
        // The server answers a same-email/phone match with the row it matched;
        // naming it beats a bare 409 and lets the user open it instead.
        onError: (error) => setDuplicate(readDuplicate(error)),
      },
    );
  }

  /** Jump to the supplier the server says already covers this account. */
  function openDuplicate(): void {
    const existing = suppliers.find((supplier) => supplier.id === duplicate?.existingId);
    if (!existing) return;
    setDuplicate(null);
    openEdit(existing);
  }

  return (
    <div className="w-full px-4 lg:px-6 pt-4 pb-8 sm:px-10">
      <PageHeader
        title="Suppliers"
        actions={
          canManage ? (
            <CreateButton onClick={openCreate}>
              Add supplier
      </CreateButton>
          ) : undefined
        }
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="w-full max-w-xs rounded-lg border border-line-hair bg-white">
          <SearchInput
            value={filters.search}
            onChange={(event) =>
              setFilters((current) => ({ ...current, search: event.target.value }))
            }
            placeholder="Search by name, trade or contact"
            aria-label="Search suppliers"
          />
        </div>
        <SimpleDropdown
          options={tradeOptions}
          value={filters.trade}
          onChange={(trade) => setFilters((current) => ({ ...current, trade }))}
          ariaLabel="Filter by trade"
        />
        <SimpleDropdown
          options={SUPPLIER_SCOPE_OPTIONS}
          value={filters.scope}
          onChange={(scope: SupplierScopeFilter) =>
            setFilters((current) => ({ ...current, scope }))
          }
          ariaLabel="Filter by scope"
        />
        <SimpleDropdown
          options={SUPPLIER_APPROVAL_OPTIONS}
          value={filters.approval}
          onChange={(approval: SupplierApprovalFilter) =>
            setFilters((current) => ({ ...current, approval }))
          }
          ariaLabel="Filter by approval"
        />
        <p className="ml-auto text-sm text-ink-muted">
          {visible.length} of {suppliers.length} supplier{suppliers.length === 1 ? "" : "s"}
        </p>
      </div>

      <SuppliersTable
        suppliers={visible}
        isPending={isLoading}
        isFiltered={isFiltering(filters)}
        canManage={canManage}
        onAdd={openCreate}
        onClearFilters={() => setFilters(EMPTY_SUPPLIER_FILTERS)}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
      />

      <UpsertSupplierDialog
        open={formOpen}
        onOpenChange={(next) => {
          setFormOpen(next);
          if (!next) {
            setEditTarget(null);
            setDuplicate(null);
          }
        }}
        initial={editTarget}
        isSubmitting={createSupplier.isPending || updateSupplier.isPending}
        error={
          duplicate
            ? null
            : createSupplier.error
              ? errorMessage(createSupplier.error)
              : updateSupplier.error
                ? errorMessage(updateSupplier.error)
                : null
        }
        force={duplicate !== null}
        banner={
          duplicate ? (
            <DuplicateSupplierNotice
              message={duplicate.message}
              canOpen={suppliers.some((supplier) => supplier.id === duplicate.existingId)}
              onOpen={openDuplicate}
              onDismiss={() => setDuplicate(null)}
            />
          ) : null
        }
        onSubmit={handleSubmit}
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
                toast("Supplier deleted", "success");
              },
              onError: (error) => toast(errorMessage(error)),
            },
          );
        }}
      />
    </div>
  );
}
