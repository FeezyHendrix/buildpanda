export interface VoiceCaller {
  userId: string;
  organizationId: string;
  can: (resource: string, action: string) => boolean;
  workspaceCan: (resource: string, action: string) => boolean;
  capabilities: Readonly<Record<string, boolean>>;
}
