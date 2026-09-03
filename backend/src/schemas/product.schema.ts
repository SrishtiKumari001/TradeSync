import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().min(2, "Product name must be at least 2 characters").max(150),
  sku: z.string().min(2, "SKU must be at least 2 characters").max(50),
  category: z.string().min(1, "Category is required").max(80),
  unitPrice: z.coerce.number().nonnegative("Unit price cannot be negative"),
  currentStock: z.coerce.number().int().nonnegative("Stock cannot be negative").default(0),
  minStockAlert: z.coerce.number().int().nonnegative("Minimum stock alert cannot be negative").default(0),
  location: z.string().max(120).optional().or(z.literal("").transform(() => undefined)),
});

export const updateProductSchema = createProductSchema.partial();

export const stockMovementSchema = z.object({
  movementType: z.enum(["IN", "OUT"], { errorMap: () => ({ message: "Movement type must be IN or OUT" }) }),
  quantity: z.coerce.number().int().positive("Quantity must be a positive whole number"),
  reason: z.string().min(1, "Reason is required").max(300),
});
