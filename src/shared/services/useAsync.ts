import { useCallback, useEffect, useRef, useState } from 'react';

/** Loads data on mount (and on reload()); keeps the last data while reloading. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const run = useCallback(() => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    load().then(
      (d) => { if (n === seq.current) { setData(d); setLoading(false); } },
      (e: Error) => { if (n === seq.current) { setError(e); setLoading(false); } },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(run, [run]);
  return { data, error, loading, reload: run, setData };
}
