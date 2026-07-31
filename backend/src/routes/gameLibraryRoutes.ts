import { Router } from "express";
import { getAll, create, update, updateManyStatus, setCover, registerAccess, remove, removeMany } from "../controllers/gameLibraryController.js";

const router = Router();

router.get("/", getAll);
router.post("/", create);
router.post("/bulk-delete", removeMany);
router.post("/bulk-update-status", updateManyStatus);
router.post("/:id/access", registerAccess);
router.put("/:id/cover", setCover);
router.put("/:id", update);
router.delete("/:id", remove);

export { router as gameLibraryRoutes };
