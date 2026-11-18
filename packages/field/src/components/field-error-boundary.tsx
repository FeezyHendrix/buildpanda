import { Component, type ReactNode } from 'react';
import { reportRenderError } from '@/instrument';
export class FieldErrorBoundary extends Component<{
    children: ReactNode;
}, {
    failed: boolean;
}> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    componentDidCatch(error: Error) { reportRenderError(error); }
    render() { return this.state.failed ? <main role="alert" className="flex h-dvh flex-col items-center justify-center gap-4 px-6 text-center"><h1 className="font-heading-bold text-xl">Could not open Field Tools</h1><p>Reload to try again. Saved offline work stays on this device.</p><button type="button" onClick={() => window.location.reload()} className="min-h-14 rounded-xl bg-primary-500 px-5 text-white">Reload Field Tools</button></main> : this.props.children; }
}
