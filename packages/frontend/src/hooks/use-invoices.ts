import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { invoiceKeys } from "./query-keys";

export type InvoiceStatus = "Draft" | "Submitted" | "Approved" | "Paid";
export type PaymentMethod =
  | "Bank Transfer"
  | "Cash"
  | "Card"
  | "Cheque"
  | "Other";

export interface InvoicePayment {
  id: string;
  amount: number;
  method: PaymentMethod;
  paidAt: string | null;
  note: string | null;
}

export interface Invoice {
  id: string;
  vendorName: string;
  trade: string;
  number: string | null;
  status: InvoiceStatus;
  amount: number;
  retainagePercentage: number;
  issueDate: string | null;
  dueDate: string | null;
  notes: string | null;
  retainageAmount: number;
  payableAmount: number;
  amountPaid: number;
  balanceDue: number;
  payments: InvoicePayment[];
}

export interface InvoiceInput {
  vendorName: string;
  trade: string;
  number?: string;
  status: InvoiceStatus;
  amount: number;
  retainagePercentage: number;
  issueDate?: string;
  dueDate?: string;
  notes?: string;
}

export interface PaymentInput {
  amount: number;
  method: PaymentMethod;
  paidAt?: string;
  note?: string;
}

export function useProjectInvoices(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId
      ? invoiceKeys.list(projectId)
      : invoiceKeys.list("__none__"),
    queryFn: async () => {
      const { data } = await api.get<Invoice[]>(
        `/projects/${projectId!}/invoices`,
      );
      return data;
    },
    enabled: Boolean(projectId),
  });
}

interface CreateInvoiceVariables extends InvoiceInput {
  projectId: string;
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, ...body }: CreateInvoiceVariables) => {
      const { data } = await api.post<Invoice>(
        `/projects/${projectId}/invoices`,
        body,
      );
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.list(projectId) });
    },
  });
}

interface EditInvoiceVariables extends InvoiceInput {
  projectId: string;
  invoiceId: string;
}

export function useEditInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      invoiceId,
      ...patch
    }: EditInvoiceVariables) => {
      const { data } = await api.put<Invoice>(
        `/projects/${projectId}/invoices/${invoiceId}`,
        patch,
      );
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.list(projectId) });
    },
  });
}

interface DeleteInvoiceVariables {
  projectId: string;
  invoiceId: string;
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, invoiceId }: DeleteInvoiceVariables) => {
      await api.delete(`/projects/${projectId}/invoices/${invoiceId}`);
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.list(projectId) });
    },
  });
}

interface AddPaymentVariables extends PaymentInput {
  projectId: string;
  invoiceId: string;
}

export function useAddInvoicePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      invoiceId,
      ...body
    }: AddPaymentVariables) => {
      const { data } = await api.post<Invoice>(
        `/projects/${projectId}/invoices/${invoiceId}/payments`,
        body,
      );
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.list(projectId) });
    },
  });
}

interface DeletePaymentVariables {
  projectId: string;
  invoiceId: string;
  paymentId: string;
}

export function useDeleteInvoicePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      invoiceId,
      paymentId,
    }: DeletePaymentVariables) => {
      await api.delete(
        `/projects/${projectId}/invoices/${invoiceId}/payments/${paymentId}`,
      );
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.list(projectId) });
    },
  });
}

export interface InvoiceAllocation {
  budgetCategoryId: string;
  amount: number;
}

export function useInvoiceAllocations(projectId: string | undefined, invoiceId: string | undefined) {
  return useQuery({
    queryKey: [...invoiceKeys.list(projectId ?? "__none__"), invoiceId, "allocations"],
    queryFn: async () => {
      const { data } = await api.get<{ allocations: InvoiceAllocation[] }>(
        `/projects/${projectId!}/invoices/${invoiceId!}/allocations`,
      );
      return data.allocations;
    },
    enabled: Boolean(projectId && invoiceId),
  });
}

export function useSetInvoiceAllocations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      invoiceId,
      allocations,
    }: {
      projectId: string;
      invoiceId: string;
      allocations: InvoiceAllocation[];
    }) => {
      const { data } = await api.put<{ allocations: InvoiceAllocation[] }>(
        `/projects/${projectId}/invoices/${invoiceId}/allocations`,
        { allocations },
      );
      return data.allocations;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.list(projectId) });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "budget"] });
    },
  });
}

