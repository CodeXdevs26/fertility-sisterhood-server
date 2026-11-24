import { z } from "zod";

const isRealDay = (value: string) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const dayString = z
  .string({ message: "startDate is required!" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be in YYYY-MM-DD format!")
  .refine(isRealDay, "startDate is not a valid date!");

const cyclePeriod = z
  .number({ message: "cyclePeriod must be a number!" })
  .int("cyclePeriod must be a whole number of days!")
  .min(1, "cyclePeriod must be at least 1 day!")
  .max(365, "cyclePeriod cannot be more than 365 days!");

export const createCycleZod = z.object({
  startDate: dayString,
  cyclePeriod: cyclePeriod.optional(),
});
export type TCreateCycle = z.infer<typeof createCycleZod>;

export const updateCycleZod = z.object({
  startDate: dayString.optional(),
  cyclePeriod: cyclePeriod.nullable().optional(),
});
export type TUpdateCycle = z.infer<typeof updateCycleZod>;

export const cycleMonthQueryZod = z.object({
  date: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "date must be in YYYY-MM format!")
    .optional(),
});
export type TCycleMonthQuery = z.infer<typeof cycleMonthQueryZod>;
