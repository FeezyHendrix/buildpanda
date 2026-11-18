const memory = new Map<string, string | null>();
export const storage = {
    getItem(key: string) {
        if (memory.has(key))
            return memory.get(key) ?? null;
        try {
            return localStorage.getItem(key);
        }
        catch {
            return null;
        }
    },
    setItem(key: string, value: string) {
        memory.set(key, value);
        try {
            localStorage.setItem(key, value);
        }
        catch { /* Keep this session's writes. */ }
    },
    removeItem(key: string) {
        memory.set(key, null);
        try {
            localStorage.removeItem(key);
        }
        catch { /* Keep the tombstone. */ }
    }
};
