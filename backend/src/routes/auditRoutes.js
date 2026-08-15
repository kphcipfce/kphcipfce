import { Router } from "express";
import { listAuditLogs } from "../controllers/auditController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
router.get("/", requireAuth, requireRole("super_admin"), asyncHandler(listAuditLogs));

export default router;
