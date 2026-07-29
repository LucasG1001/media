import { useState, useEffect, useCallback } from "react";
import { fetchSetting, saveSetting } from "../services/appSettingService";

// Preferência de UI persistida no banco (vale em qualquer dispositivo). Enquanto
// carrega — e se nunca foi salva — vale o fallback.
export function useAppSetting<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    fetchSetting<T>(key)
      .then((stored) => {
        if (!active) return;
        if (stored !== undefined) setValue(stored);
        setLoaded(true);
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [key]);

  const save = useCallback(
    async (next: T) => {
      setValue(next);
      await saveSetting(key, next);
    },
    [key]
  );

  return { value, loaded, save };
}
