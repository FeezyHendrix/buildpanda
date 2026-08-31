import { authClient } from "@/lib/auth-client";

export interface Organization {
  id: string;
  name: string;
  slug: string;
}

/**
 * Workspaces come from better-auth's organization plugin rather than the REST
 * API, so this service wraps the auth client instead of `./client`.
 */
export const organizationsApi = {
  list: async (): Promise<Organization[]> => {
    const result = await authClient.organization.list();
    if (result.error) throw new Error(result.error.message ?? "Could not load workspaces.");
    return (result.data ?? []) as Organization[];
  },

  setActive: async (organizationId: string): Promise<void> => {
    const result = await authClient.organization.setActive({ organizationId });
    if (result.error) throw new Error(result.error.message ?? "Could not switch workspace.");
  },
};
