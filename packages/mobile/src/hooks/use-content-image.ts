import { useLocalDb } from "@/db/provider";
import { useCallback, useEffect, useState } from 'react';
import { useFieldSession } from '@/lib/field-session';
import { useProjectAccess } from '@/lib/project-access-provider';
import { resolveContentImage } from '@/lib/content-images';

export function useContentImageResolver(explicitProjectId?: string) {
  const session = useFieldSession();
  const { db } = useLocalDb();
  const access = useProjectAccess();
  const projectId = explicitProjectId ?? session.projectId;
  const ready = access.ready && projectId === access.scope?.projectId;
  const resolve = useCallback(async (id: string) => {
    if (!ready || !projectId) throw new Error('Refresh project access to view this image.');
    return resolveContentImage(projectId, id, db);
  }, [projectId, ready, access.generation, db]);
  return { resolve, ready, projectId, version: `${access.generation}:${ready}` };
}

export function useContentImage(fileId: string, projectId?: string) {
  const resolver = useContentImageResolver(projectId);
  const [state, setState] = useState({ key: '', url: '', error: '' });
  const key = `${fileId}:${resolver.projectId}:${resolver.version}`;
  useEffect(() => {
    let active = true;
    if (!fileId) return;
    resolver.resolve(fileId).then((url) => { if (active) setState({ key, url, error: '' }); })
      .catch((error: unknown) => { if (active) setState({ key, url: '', error: error instanceof Error ? error.message : 'Image unavailable.' }); });
    return () => { active = false; };
  }, [fileId, key, resolver.resolve]);
  return state.key === key && resolver.ready ? state : { key, url: '', error: '' };
}
