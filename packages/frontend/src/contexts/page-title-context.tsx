import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface PageTitleState {
  title: string;
  description?: string;
}

interface PageTitleContextValue extends PageTitleState {
  setPageTitle: (title: string, description?: string) => void;
}

const PageTitleContext = createContext<PageTitleContextValue>({
  title: "",
  description: undefined,
  setPageTitle: () => {},
});

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PageTitleState>({ title: "" });

  function setPageTitle(title: string, description?: string) {
    setState({ title, description });
  }

  return (
    <PageTitleContext.Provider value={{ ...state, setPageTitle }}>
      {children}
    </PageTitleContext.Provider>
  );
}

export function usePageTitleContext() {
  return useContext(PageTitleContext);
}

export function useSetPageTitle(title: string, description?: string): void {
  const { setPageTitle } = useContext(PageTitleContext);
  useEffect(() => {
    setPageTitle(title, description);
    return () => setPageTitle("", undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description]);
}
