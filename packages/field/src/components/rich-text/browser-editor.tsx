import { useState } from 'react';
import { RichTextEditorCore } from '@buildpanda/rich-text-editor';
import '@buildpanda/rich-text-editor/styles.css';
import { useContentImageResolver } from '@/hooks/use-content-image';
import { stageContentImage } from '@/lib/content-images';
import { requireAccess, requireCurrentAccess } from '@/lib/project-access-store';
import { uploadAccess } from '@/lib/feature-access';
import { useProjectAccess } from '@/lib/project-access-provider';
import type { RichTextEditorProps } from './rich-text-editor';
export default function BrowserEditor({ value, onChange, label, placeholder, projectId, editable = true }: RichTextEditorProps) {
    const scope = useContentImageResolver(projectId);
    const access = useProjectAccess();
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    if (!scope.ready || !scope.projectId)
        return null;
    return <div className="field-stack flex flex-col gap-2">{label ? <label className="text-sm font-semibold">{label}</label> : null}<RichTextEditorCore key={scope.version} value={value} onChange={html => {
            if (editable)
                onChange(html);
        }} disabled={!editable} placeholder={placeholder} ariaLabel={label ?? placeholder} onUploadError={setError} resolveFile={scope.resolve} upload={{ ready: scope.ready, canUpload: editable && access.allows(uploadAccess), pending, error, key: scope.version, upload: async (file) => {
                const ticket = requireAccess(scope.projectId!, uploadAccess);
                setPending(true);
                setError('');
                try {
                    const uri = URL.createObjectURL(file);
                    try {
                        const image = await stageContentImage(scope.projectId!, { uri, fileName: file.name, mimeType: file.type, size: file.size });
                        requireCurrentAccess(ticket);
                        return image;
                    }
                    finally {
                        URL.revokeObjectURL(uri);
                    }
                }
                catch (error) {
                    setError(error instanceof Error ? error.message : 'Could not attach this image.');
                    throw error;
                }
                finally {
                    setPending(false);
                }
            } }}/>{error ? <p role="alert" className="text-error-600">{error}</p> : null}</div>;
}
