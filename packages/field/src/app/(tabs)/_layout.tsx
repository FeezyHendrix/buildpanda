import {useMessagingChannels} from '@/hooks/use-messaging';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { Redirect, router } from '@/navigation';
import { useAuthGate } from '@/lib/use-auth-gate';
import { useFieldSession } from '@/lib/field-session';
import { useProjectAccess } from '@/lib/project-access-provider';
import { routePermission } from '@/lib/mobile-routes';
import { captureAccess } from '@/lib/feature-access';
import { AccessUnavailable, PermissionGate } from '@/components/molecules/permission-gate';
import { VoiceCaptureSheet } from '@/components/molecules/voice-capture-sheet';
import { ConnectionBanner } from '@/components/molecules/connection-banner';
import Icon from '@/components/atoms/icon';
const tabs = [{ path: 'overview', title: 'Home', icon: 'home-outline' }, { path: 'tools', title: 'Tools', icon: 'construct-outline' }, { path: 'files', title: 'Files', icon: 'document-outline' }, { path: 'messages', title: 'Messages', icon: 'chatbubbles-outline' }] as const;
export default function TabsLayout() {
    const { user, isResolving } = useAuthGate();
    const { projectId, isReady } = useFieldSession();
    const { allows } = useProjectAccess();
    const {unread}=useMessagingChannels();
    const { pathname } = useLocation();
    const [recording, setRecording] = useState(false);
    if (isResolving || !isReady)
        return null;
    if (!user || !projectId)
        return <Redirect href="/"/>;
    return <div className="field-stack flex min-h-0 flex-1 flex-col">{pathname === '/account' ? <Outlet /> : (allows(routePermission(pathname === '/files' ? 'index' : pathname)) ? <Outlet /> : <AccessUnavailable />)}<nav aria-label="Field tools" className="flex shrink-0 flex-row border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">{tabs.slice(0, 2).map(tab => allows(routePermission(tab.path)) ? <NavLink key={tab.path} to={`/${tab.path}`} className="flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-xs aria-[current=page]:text-primary-500"><Icon name={tab.icon}/>{tab.title}{tab.path==='messages'&&unread>0?<span aria-label={`${unread} unread messages`} className="rounded-full bg-primary-500 px-1 text-white">{unread>99?'99+':unread}</span>:null}</NavLink> : null)}{allows(captureAccess) ? <button type="button" aria-label="Capture a site record" onClick={() => setRecording(true)} className="m-1 flex h-14 w-14 items-center justify-center rounded-full bg-primary-500 text-white"><Icon name="mic-outline"/></button> : null}{tabs.slice(2).map(tab => allows(routePermission(tab.path === 'files' ? 'index' : tab.path)) ? <NavLink key={tab.path} to={`/${tab.path}`} className="flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-xs aria-[current=page]:text-primary-500"><Icon name={tab.icon}/>{tab.title}{tab.path==='messages'&&unread>0?<span aria-label={`${unread} unread messages`} className="rounded-full bg-primary-500 px-1 text-white">{unread>99?'99+':unread}</span>:null}</NavLink> : null)}</nav><ConnectionBanner /><PermissionGate permission={captureAccess}><VoiceCaptureSheet visible={recording} onClose={() => setRecording(false)} onRecorded={result => { setRecording(false); router.push(`/capture?uri=${encodeURIComponent(result.uri)}&seconds=${result.durationSeconds}`); }}/></PermissionGate></div>;
}
