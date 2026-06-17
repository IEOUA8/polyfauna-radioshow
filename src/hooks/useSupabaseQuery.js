import { useState, useEffect, useCallback } from 'react';

export function useSupabaseQuery(queryFn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: err } = await queryFn();
      if (err) throw err;
      setData(result ?? []);
    } catch (err) {
      setError(err.message ?? 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    execute();
  }, [execute]);

  return { data, loading, error, refetch: execute };
}
