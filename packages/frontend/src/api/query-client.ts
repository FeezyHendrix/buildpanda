import { reportFrontendError } from "@/lib/error-reports/client";
import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: (error) => reportFrontendError(error, { kind: "query" }) }),
  mutationCache: new MutationCache({ onError: (error) => reportFrontendError(error, { kind: "mutation" }) }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      gcTime: 1000 * 60 * 10,
      refetchOnWindowFocus: true,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});
