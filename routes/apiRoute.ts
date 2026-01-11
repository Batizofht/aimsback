import { Router } from "express";
import { updateCountryCity } from "../controllers/ProfileController";
import upload from "../middlewares/upload";

const router = Router();

// Update country/city from automatic detection
router.post("/location/update", upload.none(), updateCountryCity);

export default router;
