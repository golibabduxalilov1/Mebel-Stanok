import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../lib/apiClient';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return 'Нет доступа к этим данным';
    if (err.status === 401) return 'Сессия истекла — войдите снова';
    return `Сервер вернул ошибку (${err.status})`;
  }
  return 'Не удалось загрузить данные с сервера';
}

/**
 * Loads backend data for a report block. Refetches when `key` changes, ignores responses to
 * outdated keys, and keeps errors local to the block. `key === null` disables the request.
 */
export function useAsyncData<T>(key: string | null, fetcher: () => Promise<T>): AsyncState<T> {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>({ data: null, loading: key !== null, error: null });
  const [nonce, setNonce] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    setState(prev => ({ data: prev.data, loading: true, error: null }));
    fetcherRef.current()
      .then(data => !cancelled && setState({ data, loading: false, error: null }))
      .catch(err => !cancelled && setState({ data: null, loading: false, error: describeError(err) }));
    return () => {
      cancelled = true;
    };
  }, [key, nonce]);

  const reload = useCallback(() => setNonce(n => n + 1), []);
  return { ...state, reload };
}
