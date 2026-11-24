import { z } from "zod";

export const MAX_REMINDER_TIMES = 12;

/** "HH:mm", 24-hour, in the user's local timezone (e.g. "08:00", "20:30"). */
const reminderTimeZod = z
  .string()
  .regex(
    /^([01]\d|2[0-3]):[0-5]\d$/,
    "reminderTimes must be in HH:mm (24-hour) format, e.g. 08:00"
  );

export const createMedicationZod = z.object({
  name: z.string().trim().min(1),
  dose: z.string().trim().min(1),
  frequency: z.string().trim().min(1),
  type: z.string().trim().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  reminderTimes: z
    .array(reminderTimeZod)
    .max(
      MAX_REMINDER_TIMES,
      `At most ${MAX_REMINDER_TIMES} reminder times are allowed`
    )
    .optional(),
});

export type TCreateMedication = z.infer<typeof createMedicationZod>;

export const updateMedicationZod = createMedicationZod.partial();
export type TUpdateMedication = z.infer<typeof updateMedicationZod>;
