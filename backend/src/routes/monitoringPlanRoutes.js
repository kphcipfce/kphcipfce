import { Router } from "express";
import {
  listMonitoringPlans,
  createMonitoringPlan,
  deleteMonitoringPlan,
} from "../controllers/monitoringPlanController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth);

router.get("/", asyncHandler(listMonitoringPlans));
router.post("/", requireRole("super_admin"), asyncHandler(createMonitoringPlan));
router.delete("/:id", requireRole("super_admin"), asyncHandler(deleteMonitoringPlan));

export default router;
