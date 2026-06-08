import { Router } from "express";
import { list, reply, sendNotification } from "../controllers/MessageController";

const router = Router();

router.get("/", list);
router.post("/", reply);
router.post("/notify", sendNotification);

export default router;