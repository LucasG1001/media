import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./styles/global.css";
import App from "./App";

// Precache do app shell + cache das bibliotecas e das imagens (ver vite.config.ts).
// É o que faz o app abrir sem rede nenhuma. Em dev o plugin não registra nada.
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
