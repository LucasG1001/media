import { Router } from "express";
import { getAll, create, update, updateManyStatus, registerAccess, remove, removeMany, saveSeason, saveSeasonNotes, setSeasonCover, registerSeasonAccess } from "../controllers/seriesLibraryController.js";

const router = Router();

router.get("/", getAll);
router.post("/", create);
router.post("/bulk-delete", removeMany);
router.post("/bulk-update-status", updateManyStatus);
router.post("/:id/seasons/:seasonNumber/access", registerSeasonAccess);
router.put("/:id/seasons/:seasonNumber/notes", saveSeasonNotes);
router.put("/:id/seasons/:seasonNumber", saveSeason);
router.post("/:id/access", registerAccess);
router.put("/:id/cover-season/:seasonNumber", setSeasonCover);
router.put("/:id", update);
router.delete("/:id", remove);

export { router as seriesLibraryRoutes };
