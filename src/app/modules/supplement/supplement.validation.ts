import { z } from "zod";

export const createSupplementZod = z.object({
  name: z.string().trim().min(1),
  dose: z.string().trim().min(1),
  frequency: z.string().trim().min(1),
  type: z.string().trim().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

export type TCreateSupplement = z.infer<typeof createSupplementZod>;

export const updateSupplementZod = createSupplementZod.partial();
export type TUpdateSupplement = z.infer<typeof updateSupplementZod>;
