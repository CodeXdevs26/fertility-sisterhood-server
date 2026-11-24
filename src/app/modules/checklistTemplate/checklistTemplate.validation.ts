import { ChecklistCategory } from "@prisma/client";
import { z } from "zod";

const title = z.string().trim().min(1, "Title is required").max(200);

export const createChecklistTemplateZod = z.object({
  category: z.nativeEnum(ChecklistCategory),
  title,
});

export const updateChecklistTemplateZod = z.object({
  category: z.nativeEnum(ChecklistCategory).optional(),
  title: title.optional(),
});

export type TCreateChecklistTemplate = z.infer<
  typeof createChecklistTemplateZod
>;
export type TUpdateChecklistTemplate = z.infer<
  typeof updateChecklistTemplateZod
>;
