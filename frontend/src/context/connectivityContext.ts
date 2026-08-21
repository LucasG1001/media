import { createContext, useContext } from "react";

// true = o backend respondeu a última requisição. Uma resposta, mesmo 500, prova
// alcance; só a ausência de resposta conta como offline (ver services/api.ts).
export const ConnectivityContext = createContext(true);

export function useOnline(): boolean {
  return useContext(ConnectivityContext);
}
