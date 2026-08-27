import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { Label } from "@/components/atoms/label";
import { MoneyInput } from "@/components/atoms/money-input";
import { Spinner } from "@/components/atoms/spinner";
import { Breadcrumbs } from "@/components/molecules/breadcrumbs";
import { ComboSelect, type ComboItem } from "@/components/molecules/combo-select";
import { EmptyState } from "@/components/molecules/empty-state";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { PageHeader } from "@/components/molecules/page-header";
import { ChartCard } from "@/components/molecules/chart-card";
import { Card } from "@/components/atoms/card";
import { KpiCard } from "@/components/molecules/kpi-card";
import { FinancesIcon } from "@/components/atoms/project-nav-icons";
import {
  useCreateTransaction,
  useCreateTransactionCategory,
  useDeleteTransaction,
  useDeleteTransactionCategory,
  useExportTransactionsCsv,
  useTransactionAnalytics,
  useTransactionCategories,
  useTransactions,
  useUpdateTransaction,
} from "@/hooks/use-transactions";
import { useUploadFile, resolveFileUrl } from "@/hooks/use-files";
import { useProjectContext } from "@/layouts/project-layout";
import { currencySymbol, formatCurrency, formatDayMonth } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type {
  CreateTransactionInput,
  Transaction,
  TransactionCategoryInfo,
  TransactionListFilters,
} from "@/lib/project-types";

interface TransactionFormValues {
  title: string;
  description: string;
  category: string;
  amount: string;
  transactedAt: string;
  vendor: string;
  reference: string;
  receiptFileId: string;
}

const EMPTY_FORM: TransactionFormValues = {
  title: "",
  description: "",
  category: "",
  amount: "",
  transactedAt: new Date().toISOString().split("T")[0]!,
  vendor: "",
  reference: "",
  receiptFileId: "",
};

const inputClass =
  "flex h-11 w-full rounded-lg bg-[#F6F6F6] px-4 font-sans text-base lg:text-sm text-gray-900 border-0 outline-none ring-0 placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10 disabled:cursor-not-allowed disabled:opacity-50";
const textareaClass =
  "flex w-full rounded-lg bg-[#F6F6F6] p-4 font-sans text-base lg:text-sm text-gray-900 border-0 outline-none ring-0 placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10 disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px] resize-y";

const SWATCHES = [
  "#10B981", "#3B82F6", "#6366F1", "#8B5CF6",
  "#EC4899", "#F43F5E", "#F59E0B", "#F97316",
];

function CategoryBadge({ categoryLabel, categoryColor }: { categoryLabel: string; categoryColor: string | null }) {
  const hex = categoryColor || "#6B7280";
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium"
      style={{
        backgroundColor: `${hex}26`,
        color: hex,
      }}
    >
      {categoryLabel}
    </span>
  );
}

function UpsertTransactionDialog({
  projectId,
  currency,
  initial,
  categories,
  onClose,
  onManageCategories,
}: {
  projectId: string;
  currency: string;
  initial?: Transaction | null;
  categories: TransactionCategoryInfo[];
  onClose: () => void;
  onManageCategories: () => void;
}) {
  const isEdit = Boolean(initial);
  const [values, setValues] = useState<TransactionFormValues>(() => {
    if (!initial) return { ...EMPTY_FORM };
    return {
      title: initial.title,
      description: initial.description ?? "",
      category: initial.category,
      amount: initial.amount.toString(),
      transactedAt: initial.transactedAt.split("T")[0] || "",
      vendor: initial.vendor ?? "",
      reference: initial.reference ?? "",
      receiptFileId: initial.receiptFileId ?? "",
    };
  });
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const create = useCreateTransaction(projectId);
  const update = useUpdateTransaction(projectId);
  const uploadFile = useUploadFile();
  const mutation = isEdit ? update : create;

  useEffect(() => {
    if (initial?.receiptFileId) {
      resolveFileUrl(initial.receiptFileId).then(setReceiptUrl).catch(() => {});
    }
  }, [initial?.receiptFileId]);

  const categoryItems = useMemo(() => {
    const items: ComboItem[] = categories.map((c) => ({
      id: c.key,
      label: c.label,
      group: c.type === "preset" ? "Presets" : "Custom",
    }));
    items.push({ id: "__manage__", label: "+ New category…", group: "Actions" });
    return items;
  }, [categories]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadProgress(0);
    try {
      const res = await uploadFile.mutateAsync({
        file,
        projectId,
        onProgress: setUploadProgress,
      });
      setValues((prev) => ({ ...prev, receiptFileId: res.id }));
      const url = await resolveFileUrl(res.id);
      setReceiptUrl(url);
    } catch (err) {
      console.error(err);
    } finally {
      setUploadProgress(null);
    }
  }

  function handleSubmit() {
    const payload: CreateTransactionInput = {
      title: values.title,
      description: values.description || null,
      category: values.category,
      amount: Number(values.amount),
      transactedAt: values.transactedAt,
      vendor: values.vendor || null,
      reference: values.reference || null,
      receiptFileId: values.receiptFileId || null,
    };

    if (isEdit && initial) {
      update.mutate(
        { transactionId: initial.id, body: payload },
        { onSuccess: onClose }
      );
    } else {
      create.mutate(payload, { onSuccess: onClose });
    }
  }

  const isValid = values.title && values.category && values.amount && values.transactedAt;

  return (
    <FormDrawer
      open
      onOpenChange={(open) => !open && onClose()}
      title={isEdit ? "Edit expense" : "Record expense"}
      submitLabel={isEdit ? "Save changes" : "Save entry"}
      submitting={mutation.isPending || uploadProgress !== null}
      submitDisabled={!isValid || uploadProgress !== null}
      error={mutation.error?.message}
      onSubmit={handleSubmit}
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <Label>Title *</Label>
          <input
            className={inputClass}
            value={values.title}
            onChange={(e) => setValues({ ...values, title: e.target.value })}
            placeholder="e.g. Concrete mix"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Amount *</Label>
            <MoneyInput
              value={values.amount}
              onChange={(raw) => setValues({ ...values, amount: raw })}
              currencySymbol={currencySymbol(currency)}
            />
          </div>
          <div className="space-y-2">
            <Label>Date *</Label>
            <input
              type="date"
              className={inputClass}
              value={values.transactedAt}
              onChange={(e) => setValues({ ...values, transactedAt: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Category *</Label>
          <ComboSelect
            items={categoryItems}
            value={values.category}
            onChange={(val) => {
              if (val === "__manage__") {
                onManageCategories();
              } else if (val) {
                setValues({ ...values, category: val });
              }
            }}
            placeholder="Select category"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Vendor</Label>
            <input
              className={inputClass}
              value={values.vendor}
              onChange={(e) => setValues({ ...values, vendor: e.target.value })}
              placeholder="e.g. BuildMart"
            />
          </div>
          <div className="space-y-2">
            <Label>Reference / Invoice #</Label>
            <input
              className={inputClass}
              value={values.reference}
              onChange={(e) => setValues({ ...values, reference: e.target.value })}
              placeholder="e.g. INV-1234"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <textarea
            className={textareaClass}
            value={values.description}
            onChange={(e) => setValues({ ...values, description: e.target.value })}
            placeholder="Additional details..."
          />
        </div>

        <div className="space-y-2">
          <Label>Receipt</Label>
          {values.receiptFileId && receiptUrl ? (
            <div className="relative inline-block border rounded-lg overflow-hidden border-gray-200">
              <img src={receiptUrl} alt="Receipt preview" className="h-24 w-auto object-cover bg-gray-50" />
              <button
                type="button"
                className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 text-xs hover:bg-black/70"
                onClick={() => {
                  setValues({ ...values, receiptFileId: "" });
                  setReceiptUrl(null);
                }}
              >
                ×
              </button>
            </div>
          ) : uploadProgress !== null ? (
            <div className="flex items-center gap-3 h-11 px-4 rounded-lg bg-[#F6F6F6] text-sm text-gray-500">
              <Spinner size="xs" />
              Uploading... {uploadProgress}%
            </div>
          ) : (
            <input
              type="file"
              accept="image/*,application/pdf"
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              onChange={handleFile}
            />
          )}
        </div>
      </div>
    </FormDrawer>
  );
}

function ManageCategoriesDialog({
  projectId,
  categories,
  onClose,
}: {
  projectId: string;
  categories: TransactionCategoryInfo[];
  onClose: () => void;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState(SWATCHES[0]!);
  const [deleteTarget, setDeleteTarget] = useState<TransactionCategoryInfo | null>(null);

  const create = useCreateTransactionCategory(projectId);
  const remove = useDeleteTransactionCategory(projectId);

  function handleCreate() {
    if (!newLabel.trim()) return;
    create.mutate(
      { label: newLabel, color: newColor },
      {
        onSuccess: () => {
          setNewLabel("");
        },
      }
    );
  }

  return (
    <>
      <FormDrawer
        open
        onOpenChange={(open) => !open && onClose()}
        title="Manage Categories"
        submitLabel="Done"
        onSubmit={onClose}
      >
        <div className="space-y-6">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900">Custom Categories</h4>
            <div className="flex gap-2 items-center">
              <input
                className={cn(inputClass, "flex-1")}
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Category name"
              />
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="h-11 w-11 p-1 rounded bg-[#F6F6F6] border-0 cursor-pointer"
              />
              <Button onClick={handleCreate} disabled={!newLabel.trim() || create.isPending}>
                Add
              </Button>
            </div>
          </div>

          <ul className="divide-y divide-gray-100 border-t border-gray-100">
            {categories.map((c) => (
              <li key={c.key} className="flex items-center justify-between py-3">
                <CategoryBadge categoryLabel={c.label} categoryColor={c.color} />
                {c.type === "custom" && (
                  <Button
                    variant="ghost"
                    onClick={() => setDeleteTarget(c)}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 px-2 py-1"
                  >
                    Delete
                  </Button>
                )}
                {c.type === "preset" && (
                  <span className="text-xs text-gray-400">Preset</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </FormDrawer>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Category"
        description="Are you sure? Transactions in this category will lose this association."
        variant="danger"
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={() => {
          if (deleteTarget?.categoryId) {
            remove.mutate(deleteTarget.categoryId, {
              onSuccess: () => setDeleteTarget(null),
            });
          }
        }}
      />
    </>
  );
}

export default function TransactionsPage() {
  const { project } = useProjectContext();
  const projectId = project.id;
  const currency = project.currency;

  const [filters, setFilters] = useState<TransactionListFilters>({});
  const [draftSearch, setDraftSearch] = useState("");

  const { data: transactions = [], isPending: isLoadingTx } = useTransactions(projectId, filters);
  const { data: analytics, isPending: isLoadingAnalytics } = useTransactionAnalytics(projectId, filters);
  const { data: categories = [] } = useTransactionCategories(projectId);

  const deleteTx = useDeleteTransaction(projectId);
  const exportCsv = useExportTransactionsCsv();

  const [upsertTarget, setUpsertTarget] = useState<Transaction | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);

  const pieData = useMemo(() => {
    if (!analytics?.byCategory) return [];
    return analytics.byCategory.map((c) => ({
      name: c.label,
      value: c.total,
      color: c.color || "#6B7280",
    }));
  }, [analytics]);

  const barData = useMemo(() => {
    if (!analytics?.byMonth) return [];
    return analytics.byMonth.map((m) => ({
      name: m.month,
      total: m.total,
    }));
  }, [analytics]);

  const categoryOptions = useMemo(() => {
    const items: ComboItem[] = categories.map((c) => ({
      id: c.key,
      label: c.label,
      group: c.type === "preset" ? "Presets" : "Custom",
    }));
    return items;
  }, [categories]);

  const isEmpty = transactions.length === 0 && Object.keys(filters).length === 0;

  function handleClearFilters() {
    setFilters({});
    setDraftSearch("");
  }

  function handleSearch() {
    setFilters((prev) => ({ ...prev, search: draftSearch || undefined }));
  }

  return (
    <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
      <Breadcrumbs
        items={[
          { label: "Finance", to: `/project/${projectId}/finances` },
          { label: "Spend log" },
        ]}
        className="mb-4"
      />
      <PageHeader
        title="Spend log"
        description="Record what you spend on site, with receipts."
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => exportCsv.mutate({ projectId, filters })}
              loading={exportCsv.isPending}
            >
              Export CSV
            </Button>
            <Button variant="secondary" onClick={() => setManageCategoriesOpen(true)}>
              Manage categories
            </Button>
            <Button onClick={() => setUpsertTarget("new")}>Record expense</Button>
          </div>
        }
      />

      <div className="mt-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <KpiCard
            title="Total spend"
            value={formatCurrency(analytics?.totalAmount || 0, currency)}
            icon={FinancesIcon.name}
          />
          <KpiCard
            title="Expenses recorded"
            value={(analytics?.count || 0).toString()}
            icon={FinancesIcon.name}
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="min-h-[280px]">
            <ChartCard title="Spend by Category" isLoading={isLoadingAnalytics} isEmpty={pieData.length === 0}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(val: any) => formatCurrency(Number(val), currency)}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
          <div className="min-h-[280px]">
            <ChartCard title="Monthly Spend" isLoading={isLoadingAnalytics} isEmpty={barData.length === 0}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} dy={10} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                    tickFormatter={(val) => formatCurrency(val, currency, { compact: true })}
                  />
                  <RechartsTooltip
                    formatter={(val: any) => formatCurrency(Number(val), currency)}
                    cursor={{ fill: '#F3F4F6' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="total" fill="#004DE7" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </div>

        <Card className="p-4 flex flex-wrap items-center gap-4 bg-white">
          <div className="w-48">
            <ComboSelect
              items={categoryOptions}
              value={filters.category || null}
              onChange={(val) => setFilters((p) => ({ ...p, category: val || undefined }))}
              placeholder="All categories"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              className={cn(inputClass, "w-40")}
              value={filters.from || ""}
              onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value || undefined }))}
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              className={cn(inputClass, "w-40")}
              value={filters.to || ""}
              onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value || undefined }))}
            />
          </div>
          <div className="flex-1 flex gap-2 min-w-[200px]">
            <input
              className={cn(inputClass, "flex-1")}
              placeholder="Search title, vendor, ref..."
              value={draftSearch}
              onChange={(e) => setDraftSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button variant="secondary" onClick={handleSearch}>
              Search
            </Button>
          </div>
          {Object.keys(filters).length > 0 && (
            <Button variant="ghost" onClick={handleClearFilters} className="text-gray-500">
              Clear
            </Button>
          )}
        </Card>

        <Card className="bg-white overflow-hidden">
          {isLoadingTx ? (
            <div className="flex justify-center p-12">
              <Spinner size="md" />
            </div>
          ) : isEmpty ? (
            <EmptyState
              icon={<FinancesIcon className="size-12 text-gray-300" />}
              title="No expenses recorded yet"
              description="Start recording site spend to build your log."
              action={<Button onClick={() => setUpsertTarget("new")}>Record expense</Button>}
              className="py-16"
            />
          ) : transactions.length === 0 ? (
            <EmptyState
              title="No results found"
              description="Try adjusting your filters."
              action={<Button variant="secondary" onClick={handleClearFilters}>Clear filters</Button>}
              className="py-16"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="border-b border-gray-100 bg-gray-50/50 text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Details</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Vendor</th>
                    <th className="px-4 py-3 font-medium text-right">Amount</th>
                    <th className="px-4 py-3 font-medium">Logged by</th>
                    <th className="px-4 py-3 font-medium w-[100px]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="group hover:bg-gray-50/50 cursor-pointer"
                      onClick={() => setUpsertTarget(tx)}
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        {formatDayMonth(tx.transactedAt)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium text-gray-900">{tx.title}</div>
                        {tx.description && (
                          <div className="text-xs text-gray-500 line-clamp-1 max-w-[200px] mt-0.5">
                            {tx.description}
                          </div>
                        )}
                        {tx.reference && (
                          <div className="text-xs text-gray-400 mt-0.5">Ref: {tx.reference}</div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <CategoryBadge categoryLabel={tx.categoryLabel} categoryColor={tx.categoryColor} />
                      </td>
                      <td className="px-4 py-4">{tx.vendor || "—"}</td>
                      <td className="px-4 py-4 text-right font-medium text-gray-900 tabular-nums">
                        {formatCurrency(tx.amount, currency)}
                      </td>
                      <td className="px-4 py-4 text-xs">
                        {tx.createdByName || "Unknown"}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Button
                          variant="ghost"
                          className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(tx);
                          }}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {upsertTarget && (
        <UpsertTransactionDialog
          projectId={projectId}
          currency={currency}
          initial={upsertTarget === "new" ? null : upsertTarget}
          categories={categories}
          onClose={() => setUpsertTarget(null)}
          onManageCategories={() => {
            setUpsertTarget(null);
            setManageCategoriesOpen(true);
          }}
        />
      )}

      {manageCategoriesOpen && (
        <ManageCategoriesDialog
          projectId={projectId}
          categories={categories}
          onClose={() => setManageCategoriesOpen(false)}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete transaction"
        description="Are you sure? This cannot be undone and will update the ledger balances."
        variant="danger"
        confirmLabel="Delete"
        loading={deleteTx.isPending}
        onConfirm={() => {
          if (deleteTarget) {
            deleteTx.mutate(deleteTarget.id, {
              onSuccess: () => setDeleteTarget(null),
            });
          }
        }}
      />
    </div>
  );
}
