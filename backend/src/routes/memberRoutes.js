import { Router } from "express";
import { listMembers, createMember, updateMember, deleteMember, myTeam } from "../controllers/memberController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth);
router.get("/my-team", asyncHandler(myTeam));
router.get("/", requireRole("super_admin"), asyncHandler(listMembers));
router.post("/", requireRole("super_admin"), asyncHandler(createMember));
router.patch("/:id", requireRole("super_admin"), asyncHandler(updateMember));
router.delete("/:id", requireRole("super_admin"), asyncHandler(deleteMember));

export default router;
