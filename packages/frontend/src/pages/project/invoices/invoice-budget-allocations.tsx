import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { INPUT_SM_CLASS } from "@/components/atoms/input";
import { MoneyInput } from "@/components/atoms/money-input";
import { QueryError } from "@/components/molecules/query-error";
import { useProjectBudget } from "@/hooks/use-budget";
import { useInvoiceAllocations, useSetInvoiceAllocations, type Invoice, type InvoiceAllocation } from "@/hooks/use-invoices";
import type { BudgetCategory } from "@/api/budget";
import { errorMessage } from "@/lib/api-error";
import { formatCurrency, currencySymbol } from "@/lib/formatters";
import { Money } from "@/lib/money";
import { cn } from "@/lib/utils";

interface Props { projectId: string; invoice: Invoice; currency: string; canManage: boolean }
interface DraftAllocation { categoryId: string; amount: string }
const EMPTY_ALLOCATIONS: InvoiceAllocation[] = [];

function toDraft(allocations: InvoiceAllocation[]): DraftAllocation[] {
  return allocations.map(item => ({ categoryId: item.budgetCategoryId, amount: String(item.amount) }));
}

export function InvoiceBudgetAllocations(props: Props) {
  return <AllocationForm key={props.invoice.id} {...props} />;
}
InvoiceBudgetAllocations.displayName = "InvoiceBudgetAllocations";

function AllocationForm({ projectId, invoice, currency, canManage }: Props) {
  const budget = useProjectBudget(projectId);
  const saved = useInvoiceAllocations(projectId, invoice.id);
  const save = useSetInvoiceAllocations();
  const [draft, setDraft] = useState<DraftAllocation[] | null>(null);
  // Refetches update untouched fields; they never replace an edit in progress.
  const allocations = draft ?? toDraft(saved.data ?? EMPTY_ALLOCATIONS);
  const total = Money.sum(allocations.map(item => Number(item.amount) || 0)).round(2).toNumber();
  const isOver = total > invoice.netPayable;
  const invalid = allocations.some(item => !item.categoryId || !Number.isFinite(Number(item.amount)) || Number(item.amount) <= 0);

  if (saved.error) return <QueryError error={saved.error} retry={saved.refetch} noun="budget allocations" />;
  if (budget.error) return <QueryError error={budget.error} retry={budget.refetch} noun="budget categories" />;
  if (saved.isPending || budget.isPending) return <div role="status" aria-label="Loading budget allocations"><Spinner /></div>;
  if (!budget.data) return null;

  function update(index: number, item: DraftAllocation | null) {
    setDraft(current => (current ?? allocations).flatMap((row, i) => i === index ? (item ? [item] : []) : [row]));
    save.reset();
  }

  function handleSave() {
    if (!canManage || save.isPending || invalid || isOver) return;
    save.mutate({ projectId, invoiceId: invoice.id,
      allocations: allocations.map(item => ({ budgetCategoryId: item.categoryId, amount: Number(item.amount) })),
    }, { onSuccess: result => setDraft(toDraft(result)) });
  }

  return <section aria-label="Budget allocations" className="flex flex-col gap-3 border-t border-line-hair pt-3">
    <p className="text-xs font-medium uppercase text-ink-muted">Charge to budget category</p>
    {allocations.length === 0 ? <p className="text-sm text-ink-muted">No budget allocation recorded.</p> : null}
    {allocations.map((item, index) => <AllocationRow key={index} item={item} index={index} currency={currency}
      categories={budget.data!.categories} editable={canManage} disabled={save.isPending} onChange={value => update(index, value)} />)}
    {canManage && budget.data.categories.length === 0 ? <p className="text-sm text-ink-muted">Add a category in Budget &amp; Invoices before allocating this invoice.</p> : null}
    {save.error ? <p role="alert" className="text-sm text-negative-600">{errorMessage(save.error)}</p> : null}
    {save.isSuccess ? <p role="status" className="text-sm text-success-600">Budget allocations saved.</p> : null}
    <div className="flex flex-wrap items-center justify-between gap-3">
      {canManage ? <Button variant="secondary" size="sm" disabled={save.isPending || budget.data.categories.length === 0}
        onClick={() => { setDraft(current => [...(current ?? allocations), { categoryId: budget.data!.categories[0]!.id, amount: "" }]); save.reset(); }}>Add category</Button> : null}
      <span className={cn("text-sm", isOver && "text-negative-600")}>Total: {formatCurrency(total, currency)} / {formatCurrency(invoice.netPayable, currency)}</span>
      {canManage ? <Button size="sm" loading={save.isPending} disabled={save.isPending || invalid || isOver || draft === null} onClick={handleSave}>Save allocations</Button> : null}
    </div>
  </section>;
}

function AllocationRow({ item, index, categories, currency, editable, disabled, onChange }: {
  item: DraftAllocation; index: number; categories: BudgetCategory[]; currency: string;
  editable: boolean; disabled: boolean; onChange: (value: DraftAllocation | null) => void;
}) {
  if (!editable) return <div className="flex justify-between gap-2 text-sm">
    <span>{categories.find(category => category.id === item.categoryId)?.name ?? "Category unavailable"}</span>
    <span>{formatCurrency(Number(item.amount), currency)}</span>
  </div>;

  return <div className="flex items-center gap-2">
    <select aria-label={`Budget category ${index + 1}`} value={item.categoryId} disabled={disabled}
      onChange={event => onChange({ ...item, categoryId: event.target.value })} className={cn(INPUT_SM_CLASS, "min-w-0 flex-1")}>
      {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
    </select>
    <MoneyInput aria-label={`Allocated amount ${index + 1}`} currencySymbol={currencySymbol(currency)} value={item.amount}
      onChange={amount => onChange({ ...item, amount })} disabled={disabled} className={cn(INPUT_SM_CLASS, "w-28")} />
    <Button variant="danger" size="sm" disabled={disabled} onClick={() => onChange(null)} aria-label={`Remove allocation ${index + 1}`}>Remove</Button>
  </div>;
}
