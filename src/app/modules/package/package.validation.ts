import { z } from "zod";
import { BillingCycle } from "@prisma/client";

const title = z.string().trim().min(1, "Title is required").max(100);
const productId = z.string().trim().min(1).max(200);
const description = z.array(z.string().trim().min(1).max(300)).max(20);
const currency = z
  .string()
  .trim()
  .length(3)
  .transform(value => value.toLowerCase());

export const createPackageZod = z.object({
  title,
  billingCycle: z.enum(BillingCycle),
  revenueCatProductId: productId,
  entitlementId: productId,
  description: description.default([]),
  price: z.number().positive(),
  currency: currency.optional(),
});

export const updatePackageZod = z.object({
  title: title.optional(),
  billingCycle: z.enum(BillingCycle).optional(),
  revenueCatProductId: productId.optional(),
  entitlementId: productId.optional(),
  description: description.optional(),
  price: z.number().positive().optional(),
  currency: currency.optional(),
});

export type TCreatePackage = z.infer<typeof createPackageZod>;
export type TUpdatePackage = z.infer<typeof updatePackageZod>;
