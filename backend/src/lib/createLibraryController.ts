import type { Request, Response } from "express";
import type { ZodType } from "zod";
import type { LibraryModel } from "./createLibraryModel.js";
import { notifyError } from "../services/notifyService.js";

export interface LibraryControllerMessages {
  required: string;
  invalid: string;
  duplicate: string;
  notFound: string;
  errorGetAll: string;
  errorCreate: string;
  errorUpdate: string;
  errorRemove: string;
}

export interface LibraryControllerConfig<TEntry, TCreate, TUpdate> {
  model: LibraryModel<TEntry, TCreate, TUpdate>;
  externalIdField: string;
  messages: LibraryControllerMessages;
  createSchema?: ZodType;
  updateSchema?: ZodType;
  /** Disparado após adicionar uma entrada (fire-and-forget, ex.: notificação). */
  onCreated?: (entry: TEntry) => void;
}

export interface LibraryController {
  getAll(req: Request, res: Response): Promise<void>;
  create(req: Request, res: Response): Promise<void>;
  update(req: Request, res: Response): Promise<void>;
  updateManyStatus(req: Request, res: Response): Promise<void>;
  setCover(req: Request, res: Response): Promise<void>;
  remove(req: Request, res: Response): Promise<void>;
  removeMany(req: Request, res: Response): Promise<void>;
}

export function createLibraryController<TEntry, TCreate, TUpdate>(
  config: LibraryControllerConfig<TEntry, TCreate, TUpdate>
): LibraryController {
  const { model, externalIdField, messages, createSchema, updateSchema, onCreated } = config;

  const getAll = async (_req: Request, res: Response): Promise<void> => {
    try {
      res.json(await model.findAll());
    } catch (error) {
      void notifyError(messages.errorGetAll, error);
      res.status(500).json({ error: messages.errorGetAll });
    }
  };

  const create = async (req: Request, res: Response): Promise<void> => {
    try {
      let body = req.body as Record<string, unknown>;
      if (createSchema) {
        const parsed = createSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: messages.invalid, issues: parsed.error.flatten() });
          return;
        }
        body = parsed.data as Record<string, unknown>;
      }
      if (!body[externalIdField] || !body.title) {
        res.status(400).json({ error: messages.required });
        return;
      }
      const existing = await model.findByExternalId(body[externalIdField] as number | string);
      if (existing) {
        res.status(409).json({ error: messages.duplicate, entry: existing });
        return;
      }
      const entry = await model.create(body as TCreate);
      if (onCreated) onCreated(entry);
      res.status(201).json(entry);
    } catch (error) {
      void notifyError(messages.errorCreate, error);
      res.status(500).json({ error: messages.errorCreate });
    }
  };

  const update = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = String(req.params.id);
      let body = req.body as Record<string, unknown>;
      if (updateSchema) {
        const parsed = updateSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: messages.invalid, issues: parsed.error.flatten() });
          return;
        }
        body = parsed.data as Record<string, unknown>;
      }
      const entry = await model.update(id, body as TUpdate);
      if (!entry) {
        res.status(404).json({ error: messages.notFound });
        return;
      }
      res.json(entry);
    } catch (error) {
      void notifyError(messages.errorUpdate, error);
      res.status(500).json({ error: messages.errorUpdate });
    }
  };

  const updateManyStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { ids, status } = req.body as { ids?: unknown; status?: unknown };
      if (
        !Array.isArray(ids) ||
        ids.length === 0 ||
        !ids.every((id) => typeof id === "string") ||
        typeof status !== "string" ||
        status.length === 0
      ) {
        res.status(400).json({ error: messages.invalid });
        return;
      }
      const entries = await model.updateManyStatus(ids as string[], status);
      res.json({ entries });
    } catch (error) {
      void notifyError(messages.errorUpdate, error);
      res.status(500).json({ error: messages.errorUpdate });
    }
  };

  const setCover = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!model.setCover) {
        res.status(400).json({ error: messages.invalid });
        return;
      }
      const id = String(req.params.id);
      const entry = await model.setCover(id);
      if (!entry) {
        res.status(404).json({ error: messages.notFound });
        return;
      }
      res.json(entry);
    } catch (error) {
      void notifyError(messages.errorUpdate, error);
      res.status(500).json({ error: messages.errorUpdate });
    }
  };

  const remove = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = String(req.params.id);
      const deleted = await model.remove(id);
      if (!deleted) {
        res.status(404).json({ error: messages.notFound });
        return;
      }
      res.status(204).send();
    } catch (error) {
      void notifyError(messages.errorRemove, error);
      res.status(500).json({ error: messages.errorRemove });
    }
  };

  const removeMany = async (req: Request, res: Response): Promise<void> => {
    try {
      const ids = (req.body as { ids?: unknown }).ids;
      if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string")) {
        res.status(400).json({ error: messages.invalid });
        return;
      }
      const deleted = await model.removeMany(ids as string[]);
      res.json({ deleted });
    } catch (error) {
      void notifyError(messages.errorRemove, error);
      res.status(500).json({ error: messages.errorRemove });
    }
  };

  return { getAll, create, update, updateManyStatus, setCover, remove, removeMany };
}
