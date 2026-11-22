import { DATE_EXAMPLE, ok, op, queryParam } from "../../docs/helpers.js";
import { EXPORT_SECTIONS } from "./export.validation.js";

const tag = "Export";

const example = {
  exportedAt: "2026-11-22T10:00:00.000Z",
  range: { from: "2026-01-01", to: "2026-11-30" },
  sections: {
    profile: {
      name: "Jane Doe",
      email: "jane@example.com",
      timezone: "Europe/London",
      createdAt: DATE_EXAMPLE,
    },
    appointments: [
      {
        date: DATE_EXAMPLE,
        time: "10:30 AM",
        doctor: "Dr. Smith",
        description: "Baseline scan",
        createdAt: DATE_EXAMPLE,
        questions: ["How many follicles are there?"],
      },
    ],
    medications: [
      {
        name: "Gonal-F",
        dose: "150 IU",
        frequency: "Once daily",
        type: "Injection",
        startDate: DATE_EXAMPLE,
        endDate: "2026-01-25T00:00:00.000Z",
        createdAt: DATE_EXAMPLE,
        takenDates: [DATE_EXAMPLE, "2026-01-16T09:12:00.000Z"],
      },
    ],
    checklists: [
      {
        date: DATE_EXAMPLE,
        title: "Book blood test",
        category: "MEDICAL",
        status: "PENDING",
        description: null,
      },
    ],
  },
};

const SECTION_FIELDS = [
  "| key | fields |",
  "|---|---|",
  "| `profile` | **object**: name, email, timezone, createdAt (never filtered by date) |",
  "| `symptoms` | date, symptomName, moods[], note |",
  "| `cycles` | startDate, endDate, cyclePeriod |",
  "| `appointments` | date, time, doctor, description, createdAt, questions[] (text) |",
  "| `medications` | name, dose, frequency, type, startDate, endDate, createdAt, takenDates[] |",
  "| `supplements` | same as medications |",
  "| `journals` | createdAt, title, content |",
  "| `checklists` | date, title, category, status, description |",
  "| `costs` | date, amount, isPaid, ivfRound, type, category, description |",
  "| `testResults` | date, category, name, value, unit, note |",
  "| `notes` | date, title, description, tags[] |",
  "| `documents` | date, note, file (URL) |",
  "| `photos` | date, caption, milestone, file (URL), fileSize |",
].join("\n");

export const exportSwagger = {
  tag: {
    name: tag,
    description:
      "Export the user's own data as JSON; the app builds the chosen file format (CSV/PDF/...)",
  },
  paths: {
    "/export": {
      get: op({
        tag,
        summary: "Export selected sections of my data",
        description: [
          "Returns only the selected sections. Every section except `profile` is an array sorted oldest first; an empty section is `[]`. No pagination.",
          "Date range (`from`/`to`, both optional, inclusive, UTC days) filters each section by its main date. Medications/supplements are included when their course overlaps the range or they have an intake (`takenDates`) inside it; `takenDates` is limited to the range. `journals` use `createdAt`, `cycles` use `startDate`.",
          "Not premium-gated: any logged-in user can export.",
          SECTION_FIELDS,
        ].join("\n\n"),
        access: "user",
        parameters: [
          queryParam(
            "sections",
            `Comma-separated section keys (at least one). Allowed: ${EXPORT_SECTIONS.join(", ")}`,
            { type: "string", example: "appointments,medications,checklists" },
            true
          ),
          queryParam("from", "Start day, inclusive (YYYY-MM-DD)", {
            type: "string",
            format: "date",
            example: "2026-01-01",
          }),
          queryParam("to", "End day, inclusive (YYYY-MM-DD)", {
            type: "string",
            format: "date",
            example: "2026-11-30",
          }),
        ],
        responses: ok("Data exported successfully!", {
          type: "object",
          properties: {
            exportedAt: { type: "string", format: "date-time" },
            range: {
              type: "object",
              properties: {
                from: { type: "string", nullable: true },
                to: { type: "string", nullable: true },
              },
            },
            sections: {
              type: "object",
              description: "One key per selected section",
              additionalProperties: true,
            },
          },
          example,
        }),
        errors: [422],
      }),
    },
  },
};
