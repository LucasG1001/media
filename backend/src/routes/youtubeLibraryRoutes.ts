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
  formGroup,
  addToGroup,
  removeFromGroup,
  setTagMany,
  renameCollection,
  listCollections,
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
router.post("/bulk-set-tag", setTagMany);
router.put("/:id/cover", setCover);
router.put("/:id", update);
router.delete("/:id", remove);

export { router as youtubeLibraryRoutes };
