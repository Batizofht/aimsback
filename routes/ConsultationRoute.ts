import { Router } from "express";
import { list, create, update, reply } from "../controllers/ConsultationController";

const router = Router();

router.get("/", list);
router.post("/", create);
router.patch("/", update);
router.post("/reply", reply);

export default router;