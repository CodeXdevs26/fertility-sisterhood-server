import { z } from "zod";

const isRealDay = (value: string) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const dayString = (name: string) =>
  z
    .string({ message: `${name} is required!` })
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${name} must be in YYYY-MM-DD format!`)
    .refine(isRealDay, `${name} is not a valid date!`);

const monthString = (name: string) =>
  z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, `${name} must be in YYYY-MM format!`);

const cyclePeriod = z
  .number({ message: "cyclePeriod must be a number!" })
  .int("cyclePeriod must be a whole number of days!")
  .min(1, "cyclePeriod must be at least 1 day!")
  .max(365, "cyclePeriod cannot be more than 365 days!");

const periodLength = z
  .number({ message: "periodLength must be a number!" })
  .int("periodLength must be a whole number of days!")
  .min(1, "periodLength must be at least 1 day!")
  .max(31, "periodLength cannot be more than 31 days!");

const periodWithinCycle = (value: {
  cyclePeriod?: number | null;
  periodLength?: number | null;
}) =>
  !value.cyclePeriod ||
  !value.periodLength ||
  value.periodLength <= value.cyclePeriod;
const periodWithinCycleError = {
  message: "periodLength cannot be longer than cyclePeriod!",
  path: ["periodLength"],
};

export const createCycleZod = z
  .object({
    startDate: dayString("startDate"),
    cyclePeriod: cyclePeriod.optional(),
    periodLength: periodLength.optional(),
  })
  .refine(periodWithinCycle, periodWithinCycleError);
export type TCreateCycle = z.infer<typeof createCycleZod>;

export const updateCycleZod = z
  .object({
    startDate: dayString("startDate").optional(),
    cyclePeriod: cyclePeriod.nullable().optional(),
    periodLength: periodLength.nullable().optional(),
  })
  .refine(periodWithinCycle, periodWithinCycleError);
export type TUpdateCycle = z.infer<typeof updateCycleZod>;

/** GET /cycles/by-date: `date` (or `month`) = "YYYY-MM", default this month */
export const cycleMonthQueryZod = z.object({
  date: monthString("date").optional(),
  month: monthString("month").optional(),
});
export type TCycleMonthQuery = z.infer<typeof cycleMonthQueryZod>;

/** GET /cycles: optional `month` = "YYYY-MM" */
export const cycleListQueryZod = z.object({
  month: monthString("month").optional(),
});
export type TCycleListQuery = z.infer<typeof cycleListQueryZod>;

/** GET /cycles/today: optional `date` = the app's local "YYYY-MM-DD" */
export const cycleTodayQueryZod = z.object({
  date: dayString("date").optional(),
});
export type TCycleTodayQuery = z.infer<typeof cycleTodayQueryZod>;
