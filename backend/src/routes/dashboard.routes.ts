import { Router } from "express";
import { dashboardSummary } from "../controllers/dashboard.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/summary", requireAuth, dashboardSummary);

export default router;
