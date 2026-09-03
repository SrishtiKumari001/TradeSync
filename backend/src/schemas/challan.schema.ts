import { z } from "zod";

const challanItemInputSchema = z.object({
  productId: z.number().int().positive("productId must be a positive integer"),
  quantity: z.number().int().positive("Quantity must be a positive whole number"),
});

export const createChallanSchema = z.object({
  customerId: z.number().int().positive("customerId must be a positive integer"),
  items: z.array(challanItemInputSchema).min(1, "At least one line item is required"),
});

export const updateChallanSchema = z
  .object({
    customerId: z.number().int().positive("customerId must be a positive integer").optional(),
    items: z.array(challanItemInputSchema).min(1, "At least one line item is required").optional(),
  })
  .refine((v) => v.customerId !== undefined || v.items !== undefined, {
    message: "Provide at least one field to update",
  });
