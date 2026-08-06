import { Router } from "express";
import { list, create, update, remove } from "../controllers/EventController";

const router = Router();

router.get("/", list);
router.post("/", create);
router.patch("/", update);
router.delete("/", remove);

export default router;
