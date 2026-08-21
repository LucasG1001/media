import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api, onReachabilityChange } from "../services/api";
import { ConnectivityContext } from "./connectivityContext";

const FIRST_RETRY_MS = 3000;
const MAX_RETRY_MS = 60000;
const PROBE_TIMEOUT_MS = 5000;

export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    let timer: number | null = null;
    let delay = FIRST_RETRY_MS;
    let disposed = false;

    // Offline o app não dispara requisição nenhuma, então sem esta sonda o banner
    // só sairia da tela na próxima ação do usuário.
    function scheduleProbe(): void {
      if (disposed || timer !== null) return;
      timer = window.setTimeout(() => {
        timer = null;
        api.get("/api/health", { timeout: PROBE_TIMEOUT_MS }).catch(() => {
          delay = Math.min(delay * 2, MAX_RETRY_MS);
          scheduleProbe();
        });
      }, delay);
    }

    function clearProbe(): void {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    }

    const unsubscribe = onReachabilityChange((reachable) => {
      setOnline(reachable && navigator.onLine);
      if (reachable) {
        delay = FIRST_RETRY_MS;
        clearProbe();
      } else {
        scheduleProbe();
      }
    });

    const goOffline = () => {
      setOnline(false);
      scheduleProbe();
    };
    const goOnline = () => {
      delay = FIRST_RETRY_MS;
      clearProbe();
      void api.get("/api/health", { timeout: PROBE_TIMEOUT_MS }).catch(() => scheduleProbe());
    };

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      disposed = true;
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      unsubscribe();
      clearProbe();
    };
  }, []);

  return <ConnectivityContext.Provider value={online}>{children}</ConnectivityContext.Provider>;
}
