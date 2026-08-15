import { Router } from "express";
import { listMicroPlans, getMicroPlan, createMicroPlan } from "../controllers/microPlanController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth);
router.get("/", asyncHandler(listMicroPlans));
router.get("/:id", asyncHandler(getMicroPlan));
router.post("/", requireRole("super_admin"), asyncHandler(createMicroPlan));

export default router;
