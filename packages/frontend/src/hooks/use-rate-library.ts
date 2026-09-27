import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  rateLibraryApi,
  type BuildupInput,
  type CreateQuoteSourceInput,
  type UpsertRateCardInput,
  type UpsertRateInput,
} from "@/api/rate-library";
import { rateLibraryKeys } from "@/hooks/query-keys";

export function useRateCards() {
  return useQuery({ queryKey: rateLibraryKeys.cards(), queryFn: () => rateLibraryApi.listCards() });
}

export function useQuoteSources() {
  return useQuery({ queryKey: rateLibraryKeys.quotes(), queryFn: () => rateLibraryApi.listQuotes() });
}

function useInvalidateLibrary() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: rateLibraryKeys.all });
}

export function useCreateRateCard() {
  const invalidate = useInvalidateLibrary();
  return useMutation({ mutationFn: (body: UpsertRateCardInput) => rateLibraryApi.createCard(body), onSuccess: invalidate });
}

export function useUpdateRateCard() {
  const invalidate = useInvalidateLibrary();
  return useMutation({
    mutationFn: ({ cardId, body }: { cardId: string; body: Partial<UpsertRateCardInput> }) =>
      rateLibraryApi.updateCard(cardId, body),
    onSuccess: invalidate,
  });
}

export function useDeleteRateCard() {
  const invalidate = useInvalidateLibrary();
  return useMutation({ mutationFn: (cardId: string) => rateLibraryApi.deleteCard(cardId), onSuccess: invalidate });
}

export function useAddRate() {
  const invalidate = useInvalidateLibrary();
  return useMutation({
    mutationFn: ({ cardId, body }: { cardId: string; body: UpsertRateInput }) => rateLibraryApi.addRate(cardId, body),
    onSuccess: invalidate,
  });
}

export function useUpdateRate() {
  const invalidate = useInvalidateLibrary();
  return useMutation({
    mutationFn: ({ cardId, rateId, body }: { cardId: string; rateId: string; body: Partial<UpsertRateInput> }) =>
      rateLibraryApi.updateRate(cardId, rateId, body),
    onSuccess: invalidate,
  });
}

export function useDeleteRate() {
  const invalidate = useInvalidateLibrary();
  return useMutation({
    mutationFn: ({ cardId, rateId }: { cardId: string; rateId: string }) => rateLibraryApi.deleteRate(cardId, rateId),
    onSuccess: invalidate,
  });
}

export function useSetRateBuildups() {
  const invalidate = useInvalidateLibrary();
  return useMutation({
    mutationFn: ({ cardId, rateId, lines }: { cardId: string; rateId: string; lines: BuildupInput[] }) =>
      rateLibraryApi.setBuildups(cardId, rateId, lines),
    onSuccess: invalidate,
  });
}

export function useAddQuoteSource() {
  const invalidate = useInvalidateLibrary();
  return useMutation({ mutationFn: (body: CreateQuoteSourceInput) => rateLibraryApi.addQuote(body), onSuccess: invalidate });
}

export function useDeleteQuoteSource() {
  const invalidate = useInvalidateLibrary();
  return useMutation({ mutationFn: (quoteId: string) => rateLibraryApi.deleteQuote(quoteId), onSuccess: invalidate });
}

/** Look up library rates for estimate lines; the result is indexed by input position. */
export function useMatchRates() {
  return useMutation({
    mutationFn: (items: { code?: string | null; description: string; unit: string }[]) =>
      rateLibraryApi.matchRates(items),
  });
}
