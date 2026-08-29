import { Router } from "express";
import { listExecutives, createExecutive, updateExecutive } from "../controllers/executiveController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth, requireRole("super_admin"));
router.get("/", asyncHandler(listExecutives));
router.post("/", asyncHandler(createExecutive));
router.patch("/:id", asyncHandler(updateExecutive));

export default router;
