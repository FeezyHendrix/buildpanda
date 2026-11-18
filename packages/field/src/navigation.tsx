import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
type Target = string | {
    pathname: string;
    params?: Record<string, string | number | undefined>;
};
export function href(target: Target): string {
    if (typeof target === 'string')
        return target.replace('/(tabs)/', '/').replace(/^\/\(tabs\)$/, '/overview');
    let p = href(target.pathname);
    const q = new URLSearchParams();
    for (const [key, value] of Object.entries(target.params ?? {})) {
        if (value === undefined)
            continue;
        const slot = `[${key}]`;
        if (p.includes(slot))
            p = p.replace(slot, encodeURIComponent(String(value)));
        else
            q.set(key, String(value));
    }
    return p + (q.size ? `?${q}` : '');
}
let navigate: ReturnType<typeof useNavigate> | undefined;
export function NavigationBridge() { const next = useNavigate(); useEffect(() => { navigate = next; return () => { navigate = undefined; }; }, [next]); return null; }
export const router = { push: (to: Target) => navigate?.(href(to)), replace: (to: Target) => navigate?.(href(to), { replace: true }), back: () => navigate?.(-1), canGoBack: () => Boolean(window.history.state?.idx), dismiss: () => navigate?.(-1), dismissAll: () => navigate?.('/overview', { replace: true }) };
export function Redirect({ href: to }: {
    href: Target;
}) { return <Navigate to={href(to)} replace/>; }
export function useLocalSearchParams<T = Record<string, string>>() { const params = useParams(); const [search] = useSearchParams(); return { ...Object.fromEntries(search), ...params } as T; }
export const useGlobalSearchParams = useLocalSearchParams;
export const usePathname = () => useLocation().pathname;
export const useSegments = () => usePathname().split('/').filter(Boolean);
export function useFocusEffect(effect: () => void | (() => void)) { const path = useLocation().pathname; useEffect(effect, [effect, path]); }
