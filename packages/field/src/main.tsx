import {installKeyboardInset} from '../../frontend/src/lib/keyboard-inset';
import { monitoringEnabled, reportRenderError } from './instrument';
import { FieldErrorBoundary } from './components/field-error-boundary';
import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Outlet, useLocation } from 'react-router-dom';
import { NavigationBridge, Redirect } from './navigation';
import { FieldSessionProvider } from '@/lib/field-session';
import { LocalDbProvider } from '@/db/provider';
import { ProjectAccessProvider, useProjectAccess } from '@/lib/project-access-provider';
import { SyncProvider } from '@/lib/sync-provider';
import { StageScopeProvider } from '@/lib/stage-scope';
import { OfflinePlansProvider } from '@/lib/offline-plans-provider';
import { AccessUnavailable, PermissionGate } from '@/components/molecules/permission-gate';
import { routePermission } from '@/lib/mobile-routes';
import { Spinner } from '@/components/atoms/spinner';
import TabsLayout from '@/app/(tabs)/_layout';
import { useAuthGate } from '@/lib/use-auth-gate';
import { useFieldSession } from '@/lib/field-session';
import {useTrackToolOpens} from '@/hooks/use-home-tools';
import './styles.css';
const publicRoutes=new Set(['','sign-in','select-workspace','select-project']);
function ToolOpenTracker(){useTrackToolOpens();return null;}
installKeyboardInset();
const client = new QueryClient({ defaultOptions: { queries: { staleTime: 30000, retry: 1, refetchOnReconnect: true }, mutations: { retry: 0 } } });
const pages = import.meta.glob<{
    default: React.ComponentType;
}>('./app/**/*.tsx');
const routes = Object.entries(pages).filter(([name]) => !name.endsWith('_layout.tsx')).map(([file, load]) => {
    const route = file.replace('./app/', '').replace(/\.tsx$/, '');
    const tab = route.startsWith('(tabs)/');
    const relative = route.replace('(tabs)/', '');
    const path = tab && relative === 'index' ? 'files' : relative === 'index' ? '' : relative.replace(/\/index$/, '').replace(/\[([^\]]+)\]/g, ':$1');
    return { path, tab, Page: lazy(load) };
});
function Protected() {
    const { user, isResolving } = useAuthGate();
    const { projectId, isReady } = useFieldSession();
    const { pathname } = useLocation();
    const { allows } = useProjectAccess();
    if (isResolving || !isReady)
        return <Spinner />;
    if (!user || !projectId)
        return <Redirect href="/"/>;
    return allows(routePermission(pathname)) ? <Outlet /> : <AccessUnavailable />;
}
function App() { return <FieldSessionProvider><StageScopeProvider><LocalDbProvider><ProjectAccessProvider><SyncProvider><OfflinePlansProvider><NavigationBridge /><ToolOpenTracker/><Suspense fallback={<div className="field-stack flex flex-1 items-center justify-center"><Spinner /></div>}><Routes>{routes.filter(r => !r.tab && publicRoutes.has(r.path)).map(({ path, Page }) => <Route key={path} path={path} element={<Page />}/>)}<Route element={<Protected />}>{routes.filter(r => !r.tab && !publicRoutes.has(r.path)).map(({ path, Page }) => <Route key={path} path={path} element={<Page />}/>)}</Route><Route element={<TabsLayout />}>{routes.filter(r => r.tab).map(({ path, Page }) => <Route key={path} path={path} element={<Page />}/>)}</Route><Route path="*" element={<div className="field-stack p-6"><h1>Page not found</h1><a href="/overview">Return to Field Tools</a></div>}/></Routes></Suspense></OfflinePlansProvider></SyncProvider></ProjectAccessProvider></LocalDbProvider></StageScopeProvider></FieldSessionProvider>; }
createRoot(document.getElementById('root')!, monitoringEnabled ? { onUncaughtError: reportRenderError, onRecoverableError: reportRenderError } : undefined).render(<StrictMode><FieldErrorBoundary><QueryClientProvider client={client}><BrowserRouter><App /></BrowserRouter></QueryClientProvider></FieldErrorBoundary></StrictMode>);
if (import.meta.env.PROD && 'serviceWorker' in navigator)
    window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js').catch(() => { }); });
