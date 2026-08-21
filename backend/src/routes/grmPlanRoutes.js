import { Router } from "express";
import { listGrmPlans, createGrmPlan, deleteGrmPlan } from "../controllers/grmPlanController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth);
router.get("/", asyncHandler(listGrmPlans));
router.post("/", requireRole("super_admin"), asyncHandler(createGrmPlan));
router.delete("/:id", requireRole("super_admin"), asyncHandler(deleteGrmPlan));

export default router;
