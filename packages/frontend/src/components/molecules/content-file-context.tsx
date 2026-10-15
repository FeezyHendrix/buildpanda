import { createContext, useMemo, type ReactNode } from 'react';
import api from '@/api/client';

/** A shared offer uses its narrow link capability, not workspace membership. */
export const ContentFileContext = createContext<{ key: string; resolve: (id: string) => Promise<string> } | null>(null);

export function ProposalContentFiles({ token, children }: { token: string; children: ReactNode }) {
  const access = useMemo(() => ({ key: `proposal:${token}`, resolve: (id: string) =>
    api.get<{ url: string }>(`/proposals/public/${encodeURIComponent(token)}/files/${encodeURIComponent(id)}`).then((response) => response.data.url),
  }), [token]);
  return <ContentFileContext.Provider value={access}>{children}</ContentFileContext.Provider>;
}
ProposalContentFiles.displayName = 'ProposalContentFiles';
