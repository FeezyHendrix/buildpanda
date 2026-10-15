import { useCallback, useState } from 'react';
import { Linking } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { request } from '@/api/client';
import { useFieldSession } from '@/lib/field-session';
import { VERIFIED } from '@/lib/access-requirement';
import { requireAccess, requireCurrentAccess } from '@/lib/project-access-store';

/** Linked documents use the same server file authorization as embedded images. */
export function useContentFileOpener(explicitProjectId?: string) {
  const session = useFieldSession();
  const projectId = explicitProjectId ?? session.projectId;
  const [error, setError] = useState('');
  const open = useCallback(async (fileId: string) => {
    setError('');
    try {
      const ticket = requireAccess(projectId ?? '', VERIFIED);
      const network = await NetInfo.fetch();
      if (network.isConnected !== true || network.isInternetReachable !== true) throw new Error('Connect to open this attachment.');
      requireCurrentAccess(ticket);
      const file = await request<{ url: string }>(`/files/${encodeURIComponent(fileId)}/url`);
      requireCurrentAccess(ticket);
      await Linking.openURL(file.url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open this attachment.'); }
  }, [projectId]);
  return { open, error };
}
