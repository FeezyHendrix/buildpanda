export const queryStorage = {
    getItem(key: string) { return localStorage.getItem(key); },
    setItem(key: string, value: string) { localStorage.setItem(key, value); },
    removeItem(key: string) { localStorage.removeItem(key); },
    clearProtected() {
        for (const key of Object.keys(localStorage))
            if (key.startsWith("buildpanda_cache"))
                localStorage.removeItem(key);
    }
};
