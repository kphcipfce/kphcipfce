import { Router } from "express";
import {
  listSocialMobilizerPlans,
  createSocialMobilizerPlan,
  deleteSocialMobilizerPlan,
} from "../controllers/socialMobilizerPlanController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth);
router.get("/", asyncHandler(listSocialMobilizerPlans));
router.post("/", requireRole("super_admin"), asyncHandler(createSocialMobilizerPlan));
router.delete("/:id", requireRole("super_admin"), asyncHandler(deleteSocialMobilizerPlan));

export default router;
