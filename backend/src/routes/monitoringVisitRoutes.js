import { Router } from "express";
import {
  createMonitoringVisit,
  getMonitoringVisits,
  getMonitoringVisitById,
  reviewMonitoringVisit,
} from "../controllers/monitoringVisitController.js";
import { requireAuth } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth);

router.get("/", asyncHandler(getMonitoringVisits));
router.get("/:id", asyncHandler(getMonitoringVisitById));
router.post("/", upload.array("photos", 10), asyncHandler(createMonitoringVisit));
router.patch("/:id/review", asyncHandler(reviewMonitoringVisit));

export default router;
