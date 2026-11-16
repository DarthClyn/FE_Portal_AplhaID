import { useCallback, useEffect, useRef, useState } from 'react';

// List cache: the last answer per key, kept in memory and in this tab's sessionStorage. A list page shows it at once
// and always fetches again in the background, so new entries appear without a blank loading state.
const memory = new Map<string, unknown>();
const STORE = 'alpha-portal:list-cache:';

function cached<T>(key?: string): T | null {
  if (!key) return null;
  if (memory.has(key)) return memory.get(key) as T;
  try {
    const raw = sessionStorage.getItem(STORE + key);
    if (raw) { const v = JSON.parse(raw) as T; memory.set(key, v); return v; }
  } catch { /* storage blocked */ }
  return null;
}

function remember(key: string | undefined, value: unknown) {
  if (!key) return;
  memory.set(key, value);
  try { sessionStorage.setItem(STORE + key, JSON.stringify(value)); } catch { /* too big or blocked: memory still works */ }
}

/** Forget all cached lists (on sign-out, so the next person on this browser doesn't see them). */
export function clearListCache() {
  memory.clear();
  try { Object.keys(sessionStorage).filter((k) => k.startsWith(STORE)).forEach((k) => sessionStorage.removeItem(k)); } catch { /* blocked */ }
}

interface Options {
  /** Cache key: show the last result immediately, then refresh (list pages). */
  cacheKey?: string;
  /** Also refresh when the tab gets focus again. Default: on when cacheKey is set. */
  refreshOnFocus?: boolean;
}

/** Loads data on mount (and on reload()); keeps the last data while reloading. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[] = [], opts: Options = {}) {
  const { cacheKey, refreshOnFocus = !!cacheKey } = opts;
  const [data, setDataState] = useState<T | null>(() => cached<T>(cacheKey));
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const run = useCallback(() => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    load().then(
      (d) => { if (n === seq.current) { setDataState(d); remember(cacheKey, d); setLoading(false); } },
      (e: Error) => { if (n === seq.current) { setError(e); setLoading(false); } },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(run, [run]);
  useEffect(() => {
    if (!refreshOnFocus) return;
    const onFocus = () => { if (document.visibilityState === 'visible') run(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); };
  }, [run, refreshOnFocus]);

  /** Local updates (e.g. a row marked read) also update the cache. */
  const setData = useCallback((u: T | null | ((prev: T | null) => T | null)) => {
    setDataState((prev) => {
      const next = typeof u === 'function' ? (u as (p: T | null) => T | null)(prev) : u;
      if (next != null) remember(cacheKey, next);
      return next;
    });
  }, [cacheKey]);

  return { data, error, loading, reload: run, setData };
}
