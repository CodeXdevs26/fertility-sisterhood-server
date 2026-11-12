import { z } from "zod";

export const updateSubscriptionPlanZod = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  price: z.number().positive(),
});

export type TUpdateSubscriptionPlan = z.infer<typeof updateSubscriptionPlanZod>;
