import { PhotoMilestone } from "@prisma/client";
import { z } from "zod";

export const createPhotoZod = z.object({
  caption: z.string().trim().min(1),
  milestone: z.nativeEnum(PhotoMilestone),
  date: z.coerce.date(),
});

export const photoQueryZod = z.object({
  category: z.nativeEnum(PhotoMilestone).optional(),
});

export type TCreatePhoto = z.infer<typeof createPhotoZod>;
export type TPhotoQuery = z.infer<typeof photoQueryZod>;
