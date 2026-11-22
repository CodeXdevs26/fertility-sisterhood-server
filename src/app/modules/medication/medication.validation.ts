import { z } from "zod";

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const isValidTimeZone = (timeZone: string) => {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone });
    return true;
  } catch {
    return false;
  }
};

export const createMedicationZod = z.object({
  name: z.string().trim().min(1),
  dose: z.string().trim().min(1),
  frequency: z.string().trim().min(1),
  type: z.string().trim().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  // Local reminder times ("HH:mm", 24h) in `timezone`
  reminderTimes: z
    .array(z.string().regex(TIME_REGEX, "Time must be in HH:mm (24h) format"))
    .min(1, "At least one reminder time is required")
    .max(10, "A maximum of 10 reminder times is allowed"),
  // IANA timezone; defaults to "Europe/London" at the database level
  timezone: z
    .string()
    .refine(
      isValidTimeZone,
      "Invalid timezone (use an IANA name like Europe/London)"
    )
    .optional(),
});

export type TCreateMedication = z.infer<typeof createMedicationZod>;

export const updateMedicationZod = createMedicationZod.partial();
export type TUpdateMedication = z.infer<typeof updateMedicationZod>;
