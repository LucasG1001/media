import { api } from "./api";

// Configuração de UI persistida no banco (tabela `app_setting`). `undefined` =
// nunca salva (404), aí quem chama usa o próprio default.
export async function fetchSetting<T>(key: string): Promise<T | undefined> {
  try {
    const response = await api.get<{ value: T }>(`/api/settings/${key}`);
    return response.data.value;
  } catch {
    return undefined;
  }
}

export async function saveSetting<T>(key: string, value: T): Promise<void> {
  await api.put(`/api/settings/${key}`, { value });
}
