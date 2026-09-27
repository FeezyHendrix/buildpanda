import { useCallback, type SetStateAction } from "react";
import { useSearchParams } from "react-router-dom";

/** Keeps filters and open records shareable without dropping sibling parameters. */
export function useUrlState<T extends string | null>(key: string, fallback: T, allowed?: readonly string[]) {
  const [params, setParams] = useSearchParams();
  const raw = params.get(key);
  const value = (raw !== null && (!allowed || allowed.includes(raw)) ? raw : fallback) as T;
  const setValue = useCallback((next: SetStateAction<T>) => {
    setParams(previous => {
      const result = new URLSearchParams(previous);
      const current = previous.get(key);
      const old = (current !== null && (!allowed || allowed.includes(current)) ? current : fallback) as T;
      const resolved = typeof next === "function" ? next(old) : next;
      if (resolved === null || resolved === fallback || resolved === "") result.delete(key);
      else result.set(key, resolved);
      return result;
    }, { replace: true });
  }, [key, fallback, allowed, setParams]);
  return [value, setValue] as const;
}
