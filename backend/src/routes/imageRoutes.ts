import { Router } from "express";
import { getImage, getStats } from "../controllers/imageController.js";

const router = Router();

router.get("/stats", getStats);
router.get("/", getImage);

export { router as imageRoutes };
