import { ContentFileContext } from "@/components/molecules/content-file-context";
import { contentWork } from "@buildpanda/rich-content/pending";
import { useContext, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { canStageFiles } from "@buildpanda/rich-content/access";
import { imageError } from "@buildpanda/rich-content";
import { filesApi } from "@/api/files";
import { useSession } from "@/stores/auth";
import { useProjectAccess } from "./use-participants";
import { useActiveOrganizationId, useOrgPermissions } from "./use-organization";

export function useContentScope(explicitProjectId?: string) {
  const params = useParams();
  const projectId = explicitProjectId ?? params.projectId;
  const { data: session } = useSession();
  const organizationId = useActiveOrganizationId();
  const project = useProjectAccess(projectId);
  const organization = useOrgPermissions();
  const access = projectId ? project : organization;
  const permissions = access.data?.permissions;
  const ownsAccess = projectId
    ? project.data?.userId === session?.user.id && project.data?.projectId === projectId
    : organization.data?.userId === session?.user.id && organization.data?.organizationId === organizationId;
  const ready = !!session?.user.id && ownsAccess && !access.isError && !access.isFetching && !!permissions;
  const key = JSON.stringify([session?.user.id, organizationId, projectId, ready, permissions]);
  return { projectId, ready, key, canUpload: ready && canStageFiles(permissions) };
}

export function useContentFileUrl(fileId: string, projectId?: string) {
  const scope = useContentScope(projectId);
  const publicAccess = useContext(ContentFileContext);
  const ready = !!publicAccess || scope.ready;
  const query = useQuery({
    queryKey: ['content-file', publicAccess?.key ?? scope.key, fileId],
    queryFn: () => publicAccess ? publicAccess.resolve(fileId) : filesApi.resolveUrl(fileId),
    enabled: ready && !!fileId,
    staleTime: 0, gcTime: 0, retry: false,
  });
  return { url: ready && !query.isError && !query.isFetching ? query.data : undefined, failed: query.isError, pending: query.isFetching };
}

export function useContentUpload(projectId?: string) {
  const scope = useContentScope(projectId);
  useEffect(() => {
    const blockSubmit = (event: Event) => { if (contentWork.getSnapshot()) { event.preventDefault(); event.stopPropagation(); } };
    document.addEventListener('submit', blockSubmit, true);
    return () => document.removeEventListener('submit', blockSubmit, true);
  }, []);
  const current = useRef(scope);
  current.current = scope;
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState('');
  async function upload(file: File) {
    if (inFlight.current) throw new Error('Wait for the current image to finish uploading.');
    if (!current.current.canUpload) throw new Error('Your permissions do not allow adding images here.');
    const invalid = imageError(file.type, file.size);
    if (invalid) throw new Error(invalid);
    const key = current.current.key;
    const finish = contentWork.begin();
    inFlight.current = true;
    setPending(true);
    setError('');
    try {
      const result = await filesApi.upload(file, undefined, current.current.projectId);
      if (current.current.key !== key || !current.current.canUpload) throw new Error('Access changed. Reopen this form before adding an image.');
      return { fileId: result.id, name: result.fileName };
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not upload this image. Try again.');
      throw failure;
    } finally { finish(); inFlight.current = false; setPending(false); }
  }
  return { ...scope, pending, error, setError, upload };
}
