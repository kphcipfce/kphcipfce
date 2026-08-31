import { Router } from "express";
import { listTeams, createTeam, updateTeam, deleteTeam } from "../controllers/teamController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth);
router.get("/", asyncHandler(listTeams));
router.post("/", requireRole("super_admin"), asyncHandler(createTeam));
router.patch("/:id", requireRole("super_admin"), asyncHandler(updateTeam));
router.delete("/:id", requireRole("super_admin"), asyncHandler(deleteTeam));

export default router;
