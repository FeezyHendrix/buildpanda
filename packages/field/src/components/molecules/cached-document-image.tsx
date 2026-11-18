import { useEffect, useState } from 'react';
import { readCachedFileDataUrl } from '@/lib/download-file';
import { Spinner } from '@/components/atoms/spinner';
export function CachedDocumentImage({ uri, onError }: {
    uri: string;
    onError: () => void;
}) { const [source, setSource] = useState(''); useEffect(() => { let active = true; void readCachedFileDataUrl(uri).then(url => { if (active)
    setSource(url); }).catch(() => { if (active)
    onError(); }); return () => { active = false; }; }, [uri]); return source ? <img src={source} alt="Document preview" className="min-h-0 flex-1 object-contain" onError={onError}/> : <Spinner />; }
