import { Badge } from "@/components/atoms/badge";
import { MaterialsIcon } from "@/components/atoms/project-nav-icons";
import { Spinner } from "@/components/atoms/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyRow,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/atoms/table";
import { EmptyState } from "@/components/molecules/empty-state";
import { RowActionsMenu } from "@/components/molecules/row-actions-menu";
import type { Supplier } from "@/lib/project-types";
import { formatLeadTime, SUPPLIER_SCOPE_META, supplierScope } from "./supplier-helpers";

const COLUMN_COUNT = 9;

export interface SupplierRowHandlers {
  onEdit: (supplier: Supplier) => void;
  onDelete: (supplier: Supplier) => void;
}

interface SuppliersTableProps extends SupplierRowHandlers {
  suppliers: Supplier[];
  isPending: boolean;
  /** True when a search or filter is hiding rows, rather than there being none. */
  isFiltered: boolean;
  canManage: boolean;
  onAdd: () => void;
  onClearFilters: () => void;
}

/** The supplier register: who they are, how to reach them, and how they buy. */
export function SuppliersTable({
  suppliers,
  isPending,
  isFiltered,
  canManage,
  onAdd,
  onClearFilters,
  onEdit,
  onDelete,
}: SuppliersTableProps) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-line-hair bg-white">
      <Table className="min-w-[1080px]">
        <TableHead>
          <tr>
            <TableHeaderCell>Supplier</TableHeaderCell>
            <TableHeaderCell>Scope</TableHeaderCell>
            <TableHeaderCell>Contact</TableHeaderCell>
            <TableHeaderCell>Email</TableHeaderCell>
            <TableHeaderCell>Phone</TableHeaderCell>
            <TableHeaderCell align="right">Lead time</TableHeaderCell>
            <TableHeaderCell>Payment terms</TableHeaderCell>
            <TableHeaderCell>Approved</TableHeaderCell>
            <TableHeaderCell align="right" className="w-[72px]">
              <span className="sr-only">Actions</span>
            </TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {isPending ? (
            <TableEmptyRow colSpan={COLUMN_COUNT} className="py-12">
              <div className="flex items-center justify-center">
                <Spinner size="md" />
              </div>
            </TableEmptyRow>
          ) : suppliers.length === 0 ? (
            <TableEmptyRow colSpan={COLUMN_COUNT}>
              {isFiltered ? (
                <EmptyState
                  variant="inline"
                  title="No suppliers match"
                  description="Try another trade, scope or search term."
                  action={{ label: "Clear filters", onClick: onClearFilters }}
                />
              ) : (
                <EmptyState
                  variant="inline"
                  icon={<MaterialsIcon />}
                  title="No suppliers yet"
                  description="Add the suppliers you work with to keep contact details and reorder policies in one place."
                  action={canManage ? { label: "Add supplier", onClick: onAdd } : undefined}
                />
              )}
            </TableEmptyRow>
          ) : (
            suppliers.map((supplier) => (
              <SupplierRow
                key={supplier.id}
                supplier={supplier}
                canManage={canManage}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

SuppliersTable.displayName = "SuppliersTable";

interface SupplierRowProps extends SupplierRowHandlers {
  supplier: Supplier;
  canManage: boolean;
}

function SupplierRow({ supplier, canManage, onEdit, onDelete }: SupplierRowProps) {
  const scope = SUPPLIER_SCOPE_META[supplierScope(supplier)];

  return (
    <TableRow onClick={canManage ? () => onEdit(supplier) : undefined}>
      <TableCell>
        <p className="font-medium text-ink">{supplier.name}</p>
        {supplier.trade ? <p className="mt-0.5 text-xs text-ink-muted">{supplier.trade}</p> : null}
      </TableCell>
      <TableCell>
        <Badge tone={scope.tone} variant="outline" size="sm">
          {scope.label}
        </Badge>
      </TableCell>
      <TableCell className="text-gray-600">{supplier.contactName ?? "—"}</TableCell>
      <TableCell className="text-gray-600 [overflow-wrap:anywhere]">
        {supplier.email ?? "—"}
      </TableCell>
      <TableCell className="whitespace-nowrap text-gray-600">{supplier.phone ?? "—"}</TableCell>
      <TableCell align="right" className="whitespace-nowrap tabular-nums">
        {formatLeadTime(supplier.leadTimeDays)}
      </TableCell>
      <TableCell className="text-gray-600">{supplier.paymentTerms ?? "—"}</TableCell>
      <TableCell>
        <Badge dot tone={supplier.approved ? "success" : "neutral"} size="sm">
          {supplier.approved ? "Approved" : "Not approved"}
        </Badge>
      </TableCell>
      <TableCell align="right" onClick={(event) => event.stopPropagation()}>
        <div className="flex justify-end">
          {canManage ? (
            <RowActionsMenu
              ariaLabel={`Actions for ${supplier.name}`}
              onEdit={() => onEdit(supplier)}
              onDelete={() => onDelete(supplier)}
            />
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

SupplierRow.displayName = "SupplierRow";
