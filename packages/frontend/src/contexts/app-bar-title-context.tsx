import { createContext, useContext, useEffect, type ReactNode } from "react";

interface AppBarTitleApi {
  /** Register the page's title with the shell app bar; returns an unregister. */
  setTitle: (title: string | null) => void;
}

const AppBarTitleContext = createContext<AppBarTitleApi | null>(null);

function AppBarTitleProvider({ value, children }: { value: AppBarTitleApi; children: ReactNode }) {
  return <AppBarTitleContext.Provider value={value}>{children}</AppBarTitleContext.Provider>;
}

/**
 * Pages call this with their title. Inside a shell that owns an app bar the
 * title renders there (Ernest's 64px header) and the page must not repeat it;
 * outside such a shell the hook returns `false` and the page renders it inline.
 */
function useAppBarTitle(title: string | undefined): boolean {
  const api = useContext(AppBarTitleContext);
  useEffect(() => {
    if (!api || !title) return;
    api.setTitle(title);
    return () => api.setTitle(null);
  }, [api, title]);
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = `${title} · BuildPanda`;
    return () => {
      document.title = previous;
    };
  }, [title]);
  return api !== null;
}

export { AppBarTitleProvider, useAppBarTitle, type AppBarTitleApi };
