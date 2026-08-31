import { Router } from "express";
import {
  listDistrictCoordinators,
  createDistrictCoordinator,
  updateDistrictCoordinator,
  deleteDistrictCoordinator,
} from "../controllers/districtCoordinatorController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth, requireRole("super_admin"));
router.get("/", asyncHandler(listDistrictCoordinators));
router.post("/", asyncHandler(createDistrictCoordinator));
router.patch("/:id", asyncHandler(updateDistrictCoordinator));
router.delete("/:id", asyncHandler(deleteDistrictCoordinator));

export default router;
