import { Router } from "express";
import { Role } from "@prisma/client";
import {
  addManualStockMovement,
  createProduct,
  getProduct,
  listProducts,
  listStockMovements,
  updateProduct,
} from "../controllers/product.controller.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createProductSchema, updateProductSchema, stockMovementSchema } from "../schemas/product.schema.js";

const router = Router();

router.use(requireAuth);

router.get("/", listProducts);
router.get("/:id", getProduct);
router.get("/:id/stock-movements", listStockMovements);

const writeRoles = requireRoles(Role.WAREHOUSE, Role.ADMIN);
router.post("/", writeRoles, validate(createProductSchema), createProduct);
router.patch("/:id", writeRoles, validate(updateProductSchema), updateProduct);
router.post("/:id/stock-movements", writeRoles, validate(stockMovementSchema), addManualStockMovement);

export default router;
