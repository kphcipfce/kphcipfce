import { Router } from "express";
import { listFacilities } from "../controllers/facilityController.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth);
router.get("/", asyncHandler(listFacilities));

export default router;
