import { z } from "zod";

export const EXPORT_SECTIONS = [
  "profile",
  "symptoms",
  "cycles",
  "appointments",
  "medications",
  "supplements",
  "journals",
  "checklists",
  "costs",
  "testResults",
  "notes",
  "documents",
  "photos",
] as const;

export type TExportSection = (typeof EXPORT_SECTIONS)[number];

const dayZod = (name: string) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${name} must be in YYYY-MM-DD format`)
    .refine(value => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)), {
      message: `${name} is not a valid date`,
    });

/**
 * Query: ?sections=appointments,checklists&from=2026-01-01&to=2026-11-30
 * `sections` also accepts the repeated form (?sections=a&sections=b).
 */
export const exportQueryZod = z
  .object({
    sections: z
      .union([z.string(), z.array(z.string())], {
        message: "sections is required",
      })
      .transform(value => [
        ...new Set(
          (Array.isArray(value) ? value.join(",") : value)
            .split(",")
            .map(section => section.trim())
            .filter(Boolean)
        ),
      ])
      .pipe(
        z
          .array(z.enum(EXPORT_SECTIONS))
          .min(1, "Select at least one section to export")
      ),
    from: dayZod("from").optional(),
    to: dayZod("to").optional(),
  })
  .refine(({ from, to }) => !from || !to || from <= to, {
    message: "from must be before or equal to to",
    path: ["from"],
  });

export type TExportQuery = z.infer<typeof exportQueryZod>;
