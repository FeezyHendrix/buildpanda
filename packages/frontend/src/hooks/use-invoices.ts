import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoicesApi, type InvoiceInput, type PaymentInput, type SendInvoiceInput } from "@/api/invoices";

export type {
  InvoiceStatus,
  InvoiceType,
  PaymentMethod,
  InvoicePayment,
  InvoiceLineItem,
  InvoiceParty,
  Invoice,
  InvoiceLineItemInput,
  InvoiceInput,
  PaymentInput,
  SendInvoiceInput,
  InvoiceAllocation,
} from "@/api/invoices";
import { invoiceKeys } from "./query-keys";

export function useProjectInvoices(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId
      ? invoiceKeys.list(projectId)
      : invoiceKeys.list("__none__"),
    queryFn: () => invoicesApi.list(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useInvoiceDetail(projectId: string | undefined, invoiceId: string | undefined) {
  return useQuery({
    queryKey: projectId && invoiceId
      ? invoiceKeys.detail(projectId, invoiceId)
      : invoiceKeys.detail("__none__", "__none__"),
    queryFn: () => invoicesApi.detail(projectId!, invoiceId!),
    enabled: Boolean(projectId && invoiceId),
  });
}

interface CreateInvoiceVariables extends InvoiceInput {
  projectId: string;
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, ...body }: CreateInvoiceVariables) => invoicesApi.create(projectId, body),
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
    mutationFn: ({ projectId, invoiceId, ...patch }: EditInvoiceVariables) => invoicesApi.update(projectId, invoiceId, patch),
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
    mutationFn: ({ projectId, invoiceId }: DeleteInvoiceVariables) => invoicesApi.delete(projectId, invoiceId),
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
    mutationFn: ({ projectId, invoiceId, ...body }: AddPaymentVariables) => invoicesApi.addPayment(projectId, invoiceId, body),
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
    mutationFn: ({ projectId, invoiceId, paymentId }: DeletePaymentVariables) => invoicesApi.deletePayment(projectId, invoiceId, paymentId),
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
    mutationFn: ({ projectId, invoiceId, ...body }: SendInvoiceVariables) => invoicesApi.send(projectId, invoiceId, body),
    onSuccess: (_data, { projectId, invoiceId }) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.list(projectId) });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(projectId, invoiceId) });
    },
  });
}

export function useInvoicePdf() {
  return useMutation({
    mutationFn: ({ projectId, invoiceId }: { projectId: string; invoiceId: string }) => invoicesApi.pdf(projectId, invoiceId),
  });
}



export function useInvoiceAllocations(projectId: string | undefined, invoiceId: string | undefined) {
  return useQuery({
    queryKey: [...invoiceKeys.list(projectId ?? "__none__"), invoiceId, "allocations"],
    queryFn: () => invoicesApi.getAllocations(projectId!, invoiceId!),
    enabled: Boolean(projectId && invoiceId),
  });
}

export function useSetInvoiceAllocations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, invoiceId, allocations }: { projectId: string; invoiceId: string; allocations: { budgetCategoryId: string; amount: number }[] }) => invoicesApi.setAllocations(projectId, invoiceId, allocations),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.list(projectId) });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "budget"] });
    },
  });
}
