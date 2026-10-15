/** Staging bytes is independent of authorizing the destination record's write. */
export const FILE_STAGING_PERMISSIONS = [
  ['documents', 'upload'], ['documents', 'markup'], ['bim', 'manage'], ['updates', 'post'],
  ['dailyLog', 'create'], ['dailyLog', 'void'], ['materials', 'request'], ['materials', 'manage'], ['materials', 'approve'],
  ['finances', 'manage'], ['finances', 'approve'], ['finances', 'dispute'],
  ['rfis', 'create'], ['rfis', 'manage'], ['rfis', 'respond'], ['change-requests', 'manage'], ['change-requests', 'approve'],
  ['comments', 'post'], ['messages', 'send'], ['tasks', 'add'],
  ['schedule', 'manage'], ['stages', 'manage'], ['key-dates', 'manage'],
  ['inspections', 'request'], ['inspections', 'manage'], ['approvals', 'manage'], ['approvals', 'decide'],
  ['selections', 'manage'], ['selections', 'decide'], ['permits', 'manage'], ['risks', 'manage'],
  ['contractors', 'manage'], ['teamMembers', 'manage'], ['orgProfile', 'manage'],
  ['proposals', 'create'], ['proposals', 'update'], ['leads', 'create'], ['leads', 'update'],
  ['rateCards', 'manage'], ['complianceDocs', 'manage'], ['estimates', 'price'], ['estimates', 'terms'], ['takeoffs', 'edit'],
] as const;

export function canStageFiles(permissions: Readonly<Record<string, readonly string[]>> | null | undefined): boolean {
  return !!permissions && FILE_STAGING_PERMISSIONS.some(([resource, action]) => permissions[resource]?.includes(action));
}
