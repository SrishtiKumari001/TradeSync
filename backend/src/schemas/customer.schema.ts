import { z } from "zod";
import { CustomerType, CustomerStatus } from "@prisma/client";

const mobileRegex = /^[0-9+\-\s()]{7,15}$/;

export const createCustomerSchema = z.object({
  name: z.string().min(2, "Customer name must be at least 2 characters").max(100),
  mobile: z.string().regex(mobileRegex, "Enter a valid mobile number (7-15 digits)"),
  email: z.string().email("Enter a valid email").max(100).optional().or(z.literal("").transform(() => undefined)),
  businessName: z.string().max(150).optional().or(z.literal("").transform(() => undefined)),
  gstNumber: z.string().max(20).optional().or(z.literal("").transform(() => undefined)),
  type: z.nativeEnum(CustomerType, { errorMap: () => ({ message: "Type must be RETAIL, WHOLESALE or DISTRIBUTOR" }) }).default(CustomerType.WHOLESALE),
  address: z.string().max(300).optional().or(z.literal("").transform(() => undefined)),
  status: z.nativeEnum(CustomerStatus, { errorMap: () => ({ message: "Status must be LEAD, ACTIVE or INACTIVE" }) }).default(CustomerStatus.LEAD),
  followUpDate: z.string().datetime({ offset: true }).optional().or(z.literal("").transform(() => undefined)),
  notes: z.string().max(1000).optional().or(z.literal("").transform(() => undefined)),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const createFollowUpSchema = z.object({
  note: z.string().min(1, "Note is required").max(1000),
});
