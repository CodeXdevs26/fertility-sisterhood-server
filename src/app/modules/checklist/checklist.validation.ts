import { ChecklistCategory, ChecklistStatus } from "@prisma/client";
import { z } from "zod";

const checklistFields = {
  title: z.string().trim().min(1),
  category: z.nativeEnum(ChecklistCategory),
  date: z.coerce.date().optional(),
  description: z.string().trim().optional(),
};
export const createChecklistZod = z.object(checklistFields);
export const updateChecklistZod = z
  .object({
    ...checklistFields,
    status: z.nativeEnum(ChecklistStatus),
  })
  .partial();
export const checklistQueryZod = z.object({
  category: z.nativeEnum(ChecklistCategory).optional(),
});
export const checklistListQueryZod = z.object({
  category: z.nativeEnum(ChecklistCategory).optional(),
  status: z.nativeEnum(ChecklistStatus).optional(),
  /** one calendar day, e.g. 2026-05-01 */
  date: z.coerce.date().optional(),
});
export type TChecklistListQuery = z.infer<typeof checklistListQueryZod>;
export type TCreateChecklist = z.infer<typeof createChecklistZod>;
export type TUpdateChecklist = z.infer<typeof updateChecklistZod>;
export type TChecklistQuery = z.infer<typeof checklistQueryZod>;
