import { z } from "zod";

// optional free text; "" or null clears it
const unitZod = z
  .string()
  .trim()
  .nullable()
  .optional()
  .transform(value => (value === "" ? null : value));

const testResultFields = {
  category: z.string().trim().min(1).optional(),
  name: z.string({ message: "Test name is required" }).trim().min(1, "Test name is required"),
  date: z.coerce.date({ message: "date must be a valid date (YYYY-MM-DD)" }),
  value: z.string({ message: "Result value is required" }).trim().min(1, "Result value is required"),
  unit: unitZod,
  note: z.string().trim().optional(),
};

export const createTestResultZod = z.object(testResultFields);
export const updateTestResultZod = z.object(testResultFields).partial();
export const testResultQueryZod = z.object({
  category: z.string().trim().min(1).optional(),
});
export type TCreateTestResult = z.infer<typeof createTestResultZod>;
export type TUpdateTestResult = z.infer<typeof updateTestResultZod>;
export type TTestResultQuery = z.infer<typeof testResultQueryZod>;
