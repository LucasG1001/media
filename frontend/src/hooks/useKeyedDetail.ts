import { useEffect, useRef, useState } from "react";

interface KeyedDetail<T> {
  data: T | null;
  loading: boolean;
  error: boolean;
}

// Detalhe de um item para quem troca de item sem remontar (drawers e visão de
// detalhe). O payload é guardado junto com a chave a que pertence e
// loading/error saem daí por derivação: estado solto seguiria falando do item
// anterior (mostrando-o enquanto busca, ou grudando um erro antigo). `load` e
// `onLoad` vão por ref — só a troca de `key` dispara nova busca.
export function useKeyedDetail<T>(
  key: string | number,
  load: () => Promise<T>,
  onLoad?: (data: T) => void
): KeyedDetail<T> {
  const [loaded, setLoaded] = useState<{ key: string | number; data: T } | null>(null);
  const [failedKey, setFailedKey] = useState<string | number | null>(null);
  const data = loaded?.key === key ? loaded.data : null;
  const error = failedKey === key;

  const latest = useRef({ load, onLoad });
  useEffect(() => {
    latest.current = { load, onLoad };
  });

  useEffect(() => {
    let active = true;
    latest.current
      .load()
      .then((result) => {
        if (!active) return;
        setLoaded({ key, data: result });
        latest.current.onLoad?.(result);
      })
      .catch(() => {
        if (active) setFailedKey(key);
      });

    return () => {
      active = false;
    };
  }, [key]);

  return { data, loading: !data && !error, error };
}
