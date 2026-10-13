import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useEffect, useMemo } from "react";
import { expensesApi, type ExpenseCategory } from "@/api/expenses";
import type { Db } from "@/db/client";
import { expensesRepository, type LocalExpenseInput } from "@/db/expenses-repository";
import { flushOutbox } from "@/db/outbox";
import { useFieldSession } from "@/lib/field-session";
import { usePersistentQuery } from "@/lib/persistent-query";
import { useSyncState } from "@/lib/sync-provider";

/** The server's preset categories, for a phone that has never been online on this project. */
const PRESET_CATEGORIES: ExpenseCategory[] = [
  { key: "materials", label: "Materials" },
  { key: "labour", label: "Labour" },
  { key: "equipment", label: "Equipment / Plant" },
  { key: "subcontractor", label: "Subcontractor" },
  { key: "transport", label: "Transport & Logistics" },
  { key: "permits_fees", label: "Permits & Fees" },
  { key: "utilities", label: "Utilities" },
  { key: "professional_services", label: "Professional Services" },
  { key: "preliminaries", label: "Preliminaries" },
  { key: "overhead", label: "Overhead" },
  { key: "miscellaneous", label: "Miscellaneous" },
];

export function useExpenses(db: Db, projectId: string) {
  const { isOnline } = useSyncState();
  const query = useMemo(() => expensesRepository.listQuery(db, projectId), [db, projectId]);
  const live = useLiveQuery(query, [query]);

  useEffect(() => {
    if (!isOnline) return;
    let cancelled = false;
    expensesApi.list(projectId)
      .then((rows) => {
        if (!cancelled) return expensesRepository.replaceFromServer(db, projectId, rows);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [db, projectId, isOnline]);

  return { data: live.data ?? [], isPending: live.updatedAt === undefined && !live.error };
}

export function useExpenseCategories(projectId: string | undefined): ExpenseCategory[] {
  const { storageOwnerId } = useFieldSession();
  const query = usePersistentQuery({
    queryKey: ["expenses", projectId ?? "none", "categories"],
    ownerId: storageOwnerId,
    queryFn: () => expensesApi.categories(projectId!),
    enabled: Boolean(projectId),
  });
  return query.data?.length ? query.data : PRESET_CATEGORIES;
}

export function useLogExpense(db: Db | null, projectId: string | undefined) {
  return async (input: LocalExpenseInput) => {
    if (!db || !projectId) throw new Error("Local database is not ready yet.");
    await expensesRepository.createLocal(db, projectId, input);
    void flushOutbox(db).catch(() => undefined);
  };
}
