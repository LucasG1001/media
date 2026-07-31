import { Router } from "express";
import {
  getAll,
  create,
  createFromUrl,
  update,
  updateManyStatus,
  setCover,
  remove,
  removeMany,
  addTag,
  removeTag,
  formGroup,
  addToGroup,
  removeFromGroup,
  renameCollection,
  listCollections,
  registerAccess,
} from "../controllers/youtubeLibraryController.js";

const router = Router();

router.get("/", getAll);
router.post("/", create);
router.post("/from-url", createFromUrl);
router.get("/collections", listCollections);
router.post("/collections", formGroup);
router.post("/collections/add", addToGroup);
router.post("/collections/remove", removeFromGroup);
router.put("/collections/:id", renameCollection);
router.post("/bulk-delete", removeMany);
router.post("/bulk-update-status", updateManyStatus);
router.post("/bulk-add-tag", addTag);
router.post("/bulk-remove-tag", removeTag);
router.post("/:id/access", registerAccess);
router.put("/:id/cover", setCover);
router.put("/:id", update);
router.delete("/:id", remove);

export { router as youtubeLibraryRoutes };
