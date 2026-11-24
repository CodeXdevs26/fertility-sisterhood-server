import { z } from "zod";

export const testPurchaseZod = z.object({
  packageId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid package id"),
});

export type TTestPurchase = z.infer<typeof testPurchaseZod>;
