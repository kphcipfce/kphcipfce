import { Router } from "express";
import {
  createActivity,
  listActivities,
  getActivity,
  setActivityStatus,
  setAttendancePresence,
} from "../controllers/activityController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth);
router.get("/", asyncHandler(listActivities));
router.get("/:id", asyncHandler(getActivity));
router.post("/", upload.array("photos", 6), asyncHandler(createActivity));
router.patch("/:id/status", requireRole("super_admin"), asyncHandler(setActivityStatus));
router.patch("/:id/attendance", requireRole("super_admin"), asyncHandler(setAttendancePresence));

export default router;
