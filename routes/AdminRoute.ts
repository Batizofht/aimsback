import { Router } from "express";
import { requireAdmin, requireRole } from "../middlewares/auth";
import { list, create, update, changePassword } from "../controllers/AdminController";

const router = Router();

router.get("/", requireAdmin, requireRole("admin"), list);
router.post("/", requireAdmin, requireRole("admin"), create);
router.patch("/", requireAdmin, requireRole("admin"), update);
router.post("/change-password", requireAdmin, changePassword);

export default router;