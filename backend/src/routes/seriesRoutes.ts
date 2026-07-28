import { Router } from "express";
import { getPopular, search, getById, getSeasonById } from "../controllers/seriesController.js";

const router = Router();

router.get("/popular", getPopular);
router.get("/search", search);
router.get("/:id/season/:seasonNumber", getSeasonById);
router.get("/:id", getById);

export { router as seriesRoutes };
