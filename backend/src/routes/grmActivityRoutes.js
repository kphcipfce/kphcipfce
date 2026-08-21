import { Router } from "express";
import {
  createGrmActivity,
  listGrmActivities,
  getGrmActivity,
  setGrmActivityStatus,
} from "../controllers/grmActivityController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth);
router.get("/", asyncHandler(listGrmActivities));
router.get("/:id", asyncHandler(getGrmActivity));
router.post("/", upload.array("photos", 6), asyncHandler(createGrmActivity));
router.patch("/:id/status", requireRole("super_admin"), asyncHandler(setGrmActivityStatus));

export default router;
