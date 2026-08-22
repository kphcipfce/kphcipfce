import { Router } from "express";
import {
  monitoring,
  adminStats,
  superAdminOverview,
  exportFieldTracker,
  exportCoordinatorTracker,
  exportGrmTracker,
} from "../controllers/dashboardController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth);
router.get("/monitoring", requireRole("super_admin", "district_viewer", "grm_focal"), asyncHandler(monitoring));
router.get("/admin", requireRole("super_admin"), asyncHandler(adminStats));
router.get("/super-admin", requireRole("super_admin"), asyncHandler(superAdminOverview));
router.get("/export.xlsx", requireRole("super_admin"), asyncHandler(exportFieldTracker));
router.get("/export-coordinator.xlsx", requireRole("super_admin"), asyncHandler(exportCoordinatorTracker));
router.get("/export-grm.xlsx", requireRole("super_admin"), asyncHandler(exportGrmTracker));

export default router;
