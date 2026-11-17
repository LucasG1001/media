import { Router } from "express";
import { getAll, create, rename, remove, addItems, removeItems } from "../controllers/youtubePlaylistController.js";

const router = Router();

router.get("/", getAll);
router.post("/", create);
router.put("/:id", rename);
router.delete("/:id", remove);
router.post("/:id/items", addItems);
router.post("/:id/items/remove", removeItems);

export { router as youtubePlaylistRoutes };
