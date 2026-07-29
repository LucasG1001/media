import { Router } from "express";
import {
  getAll,
  create,
  createFromUrl,
  update,
  updateManyStatus,
  remove,
  removeMany,
  addTag,
  removeTag,
} from "../controllers/youtubeLibraryController.js";

const router = Router();

router.get("/", getAll);
router.post("/", create);
router.post("/from-url", createFromUrl);
router.post("/bulk-delete", removeMany);
router.post("/bulk-update-status", updateManyStatus);
router.post("/bulk-add-tag", addTag);
router.post("/bulk-remove-tag", removeTag);
router.put("/:id", update);
router.delete("/:id", remove);

export { router as youtubeLibraryRoutes };
