import type { Request, Response } from "express";
import { notifyError } from "../services/notifyService.js";
import { AniListError } from "../services/anilistService.js";
import { HardcoverError } from "../services/hardcoverService.js";

type Handler = (req: Request, res: Response) => Promise<void>;

export function asyncHandler(context: string, fallbackMessage: string, handler: Handler): Handler {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      void notifyError(context, error);
      if (error instanceof AniListError || error instanceof HardcoverError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: fallbackMessage });
    }
  };
}
