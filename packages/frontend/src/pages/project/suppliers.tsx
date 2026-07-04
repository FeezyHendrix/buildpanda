import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { Spinner } from "@/components/atoms/spinner";
import { MaterialsIcon, PlusIcon } from "@/components/atoms/project-nav-icons";
import { Breadcrumbs } from "@/components/molecules/breadcrumbs";
import { EmptyState } from "@/components/molecules/empty-state";
import { PageHeader } from "@/components/molecules/page-header";
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
import { toast } from "@/lib/toast";

export default function ProjectSuppliers() {
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "materials", "manage");
  const { data: suppliers = [], isLoading } = useSuppliers(project.id);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const deleteSupplier = useDeleteSupplier();

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

  return (
    <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
      <Breadcrumbs
        items={[
          { label: "Materials", to: `/project/${project.id}/materials` },
          { label: "Suppliers" },
        ]}
        className="mb-4"
      />
      <PageHeader
        title="Suppliers"
        description="Your directory of material and equipment suppliers for this project."
        actions={
          canManage && (
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                setEditTarget(null);
                setFormOpen(true);
              }}
            >
              <PlusIcon className="size-4" />
              Add supplier
            </Button>
          )
        }
      />

      <section className="mt-8 flex flex-col gap-3">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="md" />
          </div>
        ) : suppliers.length === 0 ? (
          <EmptyState
            icon={<MaterialsIcon className="size-8 text-gray-300" />}
            title="No suppliers yet"
            description="Add the suppliers you work with to keep contact details and reorder policies in one place."
            action={
              canManage && (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    setEditTarget(null);
                    setFormOpen(true);
                  }}
                >
                  <PlusIcon className="size-4" />
                  Add supplier
                </Button>
              )
            }
          />
        ) : (
          suppliers.map((supplier) => (
            <Card
              key={supplier.id}
              padding="lg"
              className="flex flex-col gap-2 rounded-[16px] border-none bg-[#F8F8F8] sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col gap-1">
                <p className="text-[15px] font-semibold text-black-500">{supplier.name}</p>
                <p className="text-[13px] text-black-300">
                  {[supplier.contactName, supplier.email, supplier.phone].filter(Boolean).join(" · ") ||
                    "No contact details"}
                </p>
                {supplier.address && (
                  <p className="text-[12px] text-black-300">{supplier.address}</p>
                )}
              </div>
              {canManage && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditTarget(supplier);
                      setFormOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => setDeleteTarget(supplier)}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </Card>
          ))
        )}
      </section>

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
              onError: () => toast("Could not delete supplier"),
            },
          );
        }}
      />
    </div>
  );
}
