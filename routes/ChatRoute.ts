import { Router } from "express";
import { chat } from "../controllers/ChatController";

const router = Router();

router.post("/", chat);

export default router;
