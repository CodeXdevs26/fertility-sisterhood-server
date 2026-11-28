import { ChecklistCategory, ChecklistStatus } from "@prisma/client";
import { z } from "zod";
import { localDayZod } from "../../validation/global.validation.js";

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
    /** true = ticked (COMPLETED), false = un-ticked (PENDING) */
    isCompleted: z.boolean({ message: "isCompleted must be true or false" }),
  })
  .partial();
export const checklistQueryZod = z.object({
  category: z.nativeEnum(ChecklistCategory).optional(),
  /** the app's local date, e.g. 2026-11-28 (defaults to the user's today) */
  date: localDayZod("date").optional(),
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
