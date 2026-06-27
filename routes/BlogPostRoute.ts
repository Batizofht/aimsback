import { Router } from "express";
import { list, create, update, remove, getLatest, getBySlug } from "../controllers/BlogPostController";

const router = Router();

router.get("/", list);
router.get("/latest", getLatest);
router.get("/:slug", getBySlug);
router.post("/", create);
router.patch("/", update);
router.delete("/", remove);

export default router;