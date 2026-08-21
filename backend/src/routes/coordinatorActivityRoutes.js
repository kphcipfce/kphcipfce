import { Router } from "express";
import {
  createCoordinatorActivity,
  listCoordinatorActivities,
  getCoordinatorActivity,
  setCoordinatorActivityStatus,
} from "../controllers/coordinatorActivityController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth);
router.get("/", asyncHandler(listCoordinatorActivities));
router.get("/:id", asyncHandler(getCoordinatorActivity));
router.post("/", upload.array("photos", 6), asyncHandler(createCoordinatorActivity));
router.patch("/:id/status", requireRole("super_admin"), asyncHandler(setCoordinatorActivityStatus));

export default router;
