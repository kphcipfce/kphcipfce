import { Router } from "express";
import {
  listDistricts,
  createDistrict,
  updateDistrict,
  updateViewerPassword,
  deleteDistrict,
} from "../controllers/districtController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth);
router.get("/", asyncHandler(listDistricts));
router.post("/", requireRole("super_admin"), asyncHandler(createDistrict));
router.patch("/:id", requireRole("super_admin"), asyncHandler(updateDistrict));
router.patch("/:id/viewer-password", requireRole("super_admin"), asyncHandler(updateViewerPassword));
router.delete("/:id", requireRole("super_admin"), asyncHandler(deleteDistrict));

export default router;
