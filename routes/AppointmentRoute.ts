import { Router } from "express";
import { list, create, update } from "../controllers/AppointmentController";

const router = Router();

router.get("/", list);
router.post("/", create);
router.patch("/", update);

export default router;