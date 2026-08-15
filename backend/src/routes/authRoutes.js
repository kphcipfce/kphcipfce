import { Router } from "express";
import { login, me, bootstrapSuperAdmin } from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
router.post("/login", asyncHandler(login));
router.post("/bootstrap", asyncHandler(bootstrapSuperAdmin));
router.get("/me", requireAuth, asyncHandler(me));

export default router;
