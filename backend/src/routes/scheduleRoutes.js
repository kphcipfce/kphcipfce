import { Router } from "express";
import { listWeeks } from "../controllers/scheduleController.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth);
router.get("/weeks", asyncHandler(listWeeks));

export default router;
