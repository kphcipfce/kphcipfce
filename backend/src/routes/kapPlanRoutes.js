import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { createKapPlan, deleteKapPlan, listKapPlans } from "../controllers/kapPlanController.js";

const router = express.Router();
router.use(requireAuth);

router.get("/", listKapPlans);
router.post("/", requireRole("super_admin"), createKapPlan);
router.delete("/:id", requireRole("super_admin"), deleteKapPlan);

export default router;
