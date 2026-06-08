import { Router } from "express";
import { list, update, register, login, getMe, approve, reject, resubmit, remove, changePassword } from "../controllers/MemberController";

const router = Router();

router.get("/", list);
router.get("/me", getMe);
router.patch("/", update);
router.patch("/password", changePassword);
router.post("/register", register);
router.post("/login", login);
router.post("/approve", approve);
router.post("/reject", reject);
router.post("/resubmit", resubmit);
router.delete("/", remove);

export default router;