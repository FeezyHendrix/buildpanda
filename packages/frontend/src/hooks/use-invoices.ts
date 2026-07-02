import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { invoiceKeys } from "./query-keys";

export type InvoiceStatus = "Draft" | "Sent" | "Approved" | "PartiallyPaid" | "Paid" | "Overdue";
export type InvoiceType = "progress" | "final" | "variation" | "vendor" | "material";

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

export interface InvoiceLineItem {
  id: string;
  position: number;
  description: string;
  quantity: number | null;
  unit: string | null;
  unitRate: number;
  amount: number;
  budgetCategoryId: string | null;
  isVariation: boolean;
}

export interface InvoiceParty {
  name: string | null;
  address: string | null;
  tin: string | null;
  firsNumber: string | null;
  email: string | null;
  bank: {
    accountName: string | null;
    accountNumber: string | null;
    bankName: string | null;
  } | null;
}

export interface Invoice {
  id: string;
  invoiceType: InvoiceType;
  currency: string;
  vendorName: string;
  trade: string;
  number: string | null;
  status: InvoiceStatus;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  whtRate: number;
  whtAmount: number;
  retentionRate: number;
  retentionAmount: number;
  totalInvoiced: number;
  netPayable: number;
  amountPaid: number;
  balanceDue: number;
  payments: InvoicePayment[];
  fromParty: InvoiceParty | null;
  toParty: InvoiceParty | null;
  recipientEmail: string | null;
  ccEmails: string[] | null;
  bccEmails: string[] | null;
  poReferenceId: string | null;
  paymentClaimId: string | null;
  milestonePaymentId: string | null;
  contractReference: string | null;
  paymentTerms: string | null;
  paymentInstructions: string | null;
  coverNote: string | null;
  headerText: string | null;
  footerText: string | null;
  issueDate: string | null;
  dueDate: string | null;
  notes: string | null;
  sentAt: string | null;
  publicToken: string | null;
  viewedAt: string | null;
}

export interface InvoiceLineItemInput {
  description: string;
  quantity?: number;
  unit?: string;
  unitRate?: number;
  budgetCategoryId?: string;
  isVariation?: boolean;
}

export interface InvoiceInput {
  vendorName: string;
  trade: string;
  number?: string;
  status?: InvoiceStatus;
  amount?: number;
  retainagePercentage?: number;
  invoiceType?: InvoiceType;
  currency?: string;
  vatRate?: number;
  whtRate?: number;
  retentionRate?: number;
  issueDate?: string;
  dueDate?: string;
  notes?: string;
  fromParty?: InvoiceParty | null;
  toParty?: InvoiceParty | null;
  recipientEmail?: string;
  ccEmails?: string[];
  bccEmails?: string[];
  poReferenceId?: string;
  paymentClaimId?: string;
  milestonePaymentId?: string;
  contractReference?: string;
  paymentTerms?: string;
  paymentInstructions?: string;
  coverNote?: string;
  headerText?: string;
  footerText?: string;
  lineItems?: InvoiceLineItemInput[];
}

export interface PaymentInput {
  amount: number;
  method: PaymentMethod;
  paidAt?: string;
  note?: string;
}

export interface SendInvoiceInput {
  recipientEmail: string;
  cc?: string[];
  bcc?: string[];
  coverNote?: string;
  headerText?: string;
  footerText?: string;
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

export function useInvoiceDetail(projectId: string | undefined, invoiceId: string | undefined) {
  return useQuery({
    queryKey: projectId && invoiceId
      ? invoiceKeys.detail(projectId, invoiceId)
      : invoiceKeys.detail("__none__", "__none__"),
    queryFn: async () => {
      const { data } = await api.get<Invoice>(
        `/projects/${projectId!}/invoices/${invoiceId!}`,
      );
      return data;
    },
    enabled: Boolean(projectId && invoiceId),
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
    onSuccess: (_data, { projectId, invoiceId }) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.list(projectId) });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(projectId, invoiceId) });
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
    mutationFn: async ({ projectId, invoiceId, ...body }: AddPaymentVariables) => {
      const { data } = await api.post<InvoicePayment>(
        `/projects/${projectId}/invoices/${invoiceId}/payments`,
        body,
      );
      return data;
    },
    onSuccess: (_data, { projectId, invoiceId }) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.list(projectId) });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(projectId, invoiceId) });
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
    mutationFn: async ({ projectId, invoiceId, paymentId }: DeletePaymentVariables) => {
      await api.delete(`/projects/${projectId}/invoices/${invoiceId}/payments/${paymentId}`);
    },
    onSuccess: (_data, { projectId, invoiceId }) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.list(projectId) });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(projectId, invoiceId) });
    },
  });
}

interface SendInvoiceVariables extends SendInvoiceInput {
  projectId: string;
  invoiceId: string;
}

export function useSendInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, invoiceId, ...body }: SendInvoiceVariables) => {
      const { data } = await api.post<{ success: boolean }>(
        `/projects/${projectId}/invoices/${invoiceId}/send`,
        body,
      );
      return data;
    },
    onSuccess: (_data, { projectId, invoiceId }) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.list(projectId) });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(projectId, invoiceId) });
    },
  });
}

export function useInvoicePdf() {
  return useMutation({
    mutationFn: async ({ projectId, invoiceId }: { projectId: string; invoiceId: string }) => {
      const response = await api.get(`/projects/${projectId}/invoices/${invoiceId}/pdf`, {
        responseType: "blob",
      });
      return response.data;
    },
  });
}

export interface InvoiceAllocation {
  id: string;
  invoiceId: string;
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
      allocations: { budgetCategoryId: string; amount: number }[];
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
