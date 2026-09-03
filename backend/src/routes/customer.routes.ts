import { Router } from "express";
import {
  addFollowUp,
  createCustomer,
  getCustomer,
  listCustomers,
  listFollowUps,
  updateCustomer,
} from "../controllers/customer.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createCustomerSchema, updateCustomerSchema, createFollowUpSchema } from "../schemas/customer.schema.js";

const router = Router();

router.use(requireAuth);

router.get("/", listCustomers);
router.post("/", validate(createCustomerSchema), createCustomer);
router.get("/:id", getCustomer);
router.patch("/:id", validate(updateCustomerSchema), updateCustomer);
router.get("/:id/follow-ups", listFollowUps);
router.post("/:id/follow-ups", validate(createFollowUpSchema), addFollowUp);

export default router;
