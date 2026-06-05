import { Router } from "express";
import { updateProfileFields, removeImageSlot } from "../controllers/WebController";

const router = Router();

// Profile field updates (fors, Orientation, looking)
router.post("/profile/update-fields", updateProfileFields);

// Remove image from specific slot
router.post("/profile/remove-image", removeImageSlot);

export default router;
