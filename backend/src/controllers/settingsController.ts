import { asyncHandler } from "../lib/asyncHandler.js";
import { getSetting, setSetting } from "../models/settingModel.js";

const KEY_PATTERN = /^[a-z0-9-]{1,64}$/;

export const getOne = asyncHandler(
  "API GET /api/settings/:key",
  "Erro ao buscar configuração.",
  async (req, res) => {
    const key = String(req.params.key);
    if (!KEY_PATTERN.test(key)) {
      res.status(400).json({ error: "Chave inválida." });
      return;
    }
    const value = await getSetting(key);
    if (value === undefined) {
      res.status(404).json({ error: "Configuração não encontrada." });
      return;
    }
    res.json({ value });
  }
);

export const putOne = asyncHandler(
  "API PUT /api/settings/:key",
  "Erro ao salvar configuração.",
  async (req, res) => {
    const key = String(req.params.key);
    if (!KEY_PATTERN.test(key)) {
      res.status(400).json({ error: "Chave inválida." });
      return;
    }
    if (req.body?.value === undefined) {
      res.status(400).json({ error: "Informe o valor da configuração." });
      return;
    }
    await setSetting(key, req.body.value);
    res.json({ value: req.body.value });
  }
);
