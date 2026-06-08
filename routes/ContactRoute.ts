import { Router } from "express";
import { submit, list, reply } from "../controllers/ContactController";

const router = Router();

router.post("/", submit);
router.get("/", list);
router.post("/reply", reply);

export default router;