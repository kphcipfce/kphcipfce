import express from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  createKapSurvey,
  exportKapSurveysExcel,
  getKapAnalytics,
  getKapSurveyById,
  getKapSurveys,
  reviewKapSurvey,
} from "../controllers/kapSurveyController.js";

const router = express.Router();
router.use(requireAuth);

router.get("/", getKapSurveys);
router.get("/analytics", getKapAnalytics);
router.get("/export", exportKapSurveysExcel);
router.get("/:id", getKapSurveyById);
router.post("/", createKapSurvey);
router.put("/:id/review", reviewKapSurvey);

export default router;
