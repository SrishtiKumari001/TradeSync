import { Router } from "express";
import { Role } from "@prisma/client";
import {
  cancelChallan,
  confirmChallan,
  createChallan,
  getChallan,
  listChallans,
  updateChallan,
} from "../controllers/challan.controller.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createChallanSchema, updateChallanSchema } from "../schemas/challan.schema.js";

const router = Router();

router.use(requireAuth);

router.get("/", listChallans);
router.get("/:id", getChallan);

const salesRoles = requireRoles(Role.SALES, Role.ADMIN);
router.post("/", salesRoles, validate(createChallanSchema), createChallan);
router.patch("/:id", salesRoles, validate(updateChallanSchema), updateChallan);
router.post("/:id/confirm", salesRoles, confirmChallan);
router.post("/:id/cancel", salesRoles, cancelChallan);

export default router;
