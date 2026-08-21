import { Router } from "express";
import { listCoordinatorPlans, createCoordinatorPlan, deleteCoordinatorPlan } from "../controllers/coordinatorPlanController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth);
router.get("/", asyncHandler(listCoordinatorPlans));
router.post("/", requireRole("super_admin"), asyncHandler(createCoordinatorPlan));
router.delete("/:id", requireRole("super_admin"), asyncHandler(deleteCoordinatorPlan));

export default router;
