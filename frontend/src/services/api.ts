import axios from "axios";

// O default é relativo de propósito: em dev o proxy do Vite manda /api para :3333
// e em prod o Caddy faz o mesmo. Uma base absoluta tornaria as chamadas
// cross-origin, e as regras de runtime cache do Service Worker — que casam
// caminho a partir da mesma origem — deixariam de valer sem nenhum erro visível.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/",
  timeout: 15000,
});

export type ApiErrorKind = "offline" | "timeout" | "notFound" | "server" | "client";

export interface ApiFailure {
  kind: ApiErrorKind;
  status: number | null;
  message: string | null;
}

type ReachabilityListener = (reachable: boolean) => void;

const listeners = new Set<ReachabilityListener>();

export function onReachabilityChange(listener: ReachabilityListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(reachable: boolean): void {
  for (const listener of listeners) listener(reachable);
}

// Uma resposta — mesmo 500 — prova que o servidor está alcançável; só a ausência
// de resposta significa offline. É essa distinção que separa "API externa caiu"
// de "sem rede", e é o que o banner e os botões de escrita consomem.
api.interceptors.response.use(
  (response) => {
    emit(true);
    return response;
  },
  (error) => {
    if (axios.isCancel(error)) return Promise.reject(error);
    emit(Boolean(axios.isAxiosError(error) && error.response));
    return Promise.reject(error);
  }
);

export function apiFailure(error: unknown): ApiFailure {
  if (!axios.isAxiosError(error)) return { kind: "server", status: null, message: null };

  const message = (error.response?.data as { error?: string } | undefined)?.error ?? null;
  if (!error.response) {
    return { kind: error.code === "ECONNABORTED" ? "timeout" : "offline", status: null, message };
  }

  const status = error.response.status;
  if (status === 404) return { kind: "notFound", status, message };
  if (status >= 500) return { kind: "server", status, message };
  return { kind: "client", status, message };
}

export function failureMessage(error: unknown, fallback: string): string {
  const failure = apiFailure(error);
  if (failure.kind === "offline") return "Sem conexão — mostrando os dados salvos.";
  if (failure.kind === "timeout") return "O servidor demorou demais a responder.";
  return failure.message ?? fallback;
}

export { api };
