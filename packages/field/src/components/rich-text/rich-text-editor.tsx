import { lazy, Suspense } from 'react';
import { Spinner } from '@/components/atoms/spinner';
const Editor = lazy(() => import('./browser-editor'));
export interface RichTextEditorProps {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    label?: string;
    projectId?: string;
    compact?: boolean;
    editable?: boolean;
}
export function RichTextEditor(props: RichTextEditorProps) { return <Suspense fallback={<Spinner />}><Editor {...props}/></Suspense>; }
