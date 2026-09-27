export const personalWorkKeys = {
  all: (projectId: string) => ["personal-work", projectId] as const,
  user: (projectId: string, userId: string) => ["personal-work", projectId, userId] as const,
};
