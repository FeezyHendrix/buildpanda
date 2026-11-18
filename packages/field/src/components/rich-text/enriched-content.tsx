import { useState } from 'react';
import type { ContentImage } from '@buildpanda/rich-content';
import { fileIdFromPath } from '@buildpanda/rich-content';
import { useContentFileOpener } from '@/hooks/use-content-file-opener';
import { useEditorImages } from './use-editor-images';
import { richTextDocument, safeRichTextLink } from './html-document';
export function EnrichedContent({ html, projectId, onImage }: {
    html: string;
    projectId?: string;
    onImage: (image: ContentImage) => void;
}) {
    const assets = useEditorImages(html, projectId);
    const files = useContentFileOpener(projectId);
    const [error, setError] = useState('');
    return <div><div className="field-stack field-rich-content" dangerouslySetInnerHTML={{ __html: richTextDocument(html, assets.images, true) }} onClick={event => {
            const target = event.target as HTMLElement;
            const anchor = target.closest('a');
            if (anchor) {
                event.preventDefault();
                const href = anchor.getAttribute('href') ?? '';
                const file = fileIdFromPath(href);
                if (file)
                    void files.open(file).catch(() => setError('Could not open this file.'));
                else if (safeRichTextLink(href))
                    window.open(href, '_blank', 'noopener,noreferrer');
            }
            if (target instanceof HTMLImageElement) {
                const image = assets.images.find(image => image.source === target.src);
                if (image)
                    onImage(image);
            }
        }}/>{error || assets.error || files.error ? <p role="alert">{error || assets.error || files.error}</p> : null}</div>;
}
