import { Router } from "express";
import { getOne, putOne } from "../controllers/settingsController.js";

const router = Router();

router.get("/:key", getOne);
router.put("/:key", putOne);

export { router as settingsRoutes };
