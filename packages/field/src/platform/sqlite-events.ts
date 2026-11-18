export class NativeModule {
    private listeners = new Map<string, Set<(payload: unknown) => void>>();
    addListener(name: string, listener: (payload: unknown) => void) { const group = this.listeners.get(name) ?? new Set(); group.add(listener); this.listeners.set(name, group); return { remove: () => group.delete(listener) }; }
    emit(name: string, payload: unknown) {
        for (const listener of this.listeners.get(name) ?? [])
            listener(payload);
    }
}
export const registerWebModule = <T>(type: new () => T) => new type();
