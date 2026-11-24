import { obj } from "../../docs/fields.js";
import {
  ID_EXAMPLE,
  idParam,
  jsonBody,
  ok,
  op,
  queryParam,
  ref,
} from "../../docs/helpers.js";

const tag = "Cycles";

const startDate = {
  type: "string",
  format: "date",
  example: "2025-11-30",
  description: "First day of the cycle (YYYY-MM-DD).",
};

const cyclePeriod = {
  type: "integer",
  minimum: 1,
  maximum: 365,
  example: 10,
  description:
    "Cycle length in days. `endDate = startDate + cyclePeriod - 1`. Omit for an ongoing cycle.",
};

const cycleDayItem = {
  type: "object",
  properties: {
    date: { type: "string", format: "date", example: "2025-12-01" },
    cycleDay: { type: "integer", example: 2 },
    cycleNumber: { type: "integer", example: 1 },
    cycleId: { type: "string", example: ID_EXAMPLE },
  },
};

export const cycleSwagger = {
  tag: {
    name: tag,
    description: "Cycle start date and length, used by the calendar (premium)",
  },
  paths: {
    "/cycles": {
      post: op({
        tag,
        summary: "Create cycle",
        description:
          "Cycles of a user cannot overlap (`409`). If an **ongoing** cycle (no `cyclePeriod`) started earlier, it is closed automatically the day before the new cycle starts.",
        access: "user",
        premium: true,
        requestBody: jsonBody(obj({ startDate, cyclePeriod }, ["startDate"])),
        responses: ok("Cycle created successfully!", ref("Cycle"), 201),
        errors: [409],
      }),
      get: op({
        tag,
        summary: "List all my cycles",
        description: "All cycles, newest first. No pagination.",
        access: "user",
        premium: true,
        responses: ok("Cycles fetched successfully!", {
          type: "array",
          items: ref("Cycle"),
        }),
      }),
    },
    "/cycles/by-date": {
      get: op({
        tag,
        summary: "Get cycle days of a month (calendar)",
        description:
          "Returns only the days of the month that fall inside a cycle, each with its `cycleDay` (CD) and `cycleNumber`. Ongoing cycles are filled up to today. Empty array if there is no cycle in that month.",
        access: "user",
        premium: true,
        parameters: [
          queryParam(
            "date",
            "Month in YYYY-MM format. Defaults to the current month.",
            {
              type: "string",
              example: "2025-12",
            }
          ),
        ],
        responses: ok("Cycle days fetched successfully!", {
          type: "array",
          items: cycleDayItem,
        }),
        errors: [422],
      }),
    },
    "/cycles/{id}": {
      patch: op({
        tag,
        summary: "Update cycle",
        description:
          "All fields optional. Send `cyclePeriod: null` to make the cycle ongoing again. `endDate` is recalculated.",
        access: "user",
        premium: true,
        parameters: [idParam()],
        requestBody: jsonBody(
          obj({ startDate, cyclePeriod: { ...cyclePeriod, nullable: true } })
        ),
        responses: ok("Cycle updated successfully!", ref("Cycle")),
        errors: [404, 409],
      }),
      delete: op({
        tag,
        summary: "Delete cycle",
        access: "user",
        premium: true,
        parameters: [idParam()],
        responses: ok("Cycle deleted successfully!", ref("Cycle")),
        errors: [404],
      }),
    },
  },
};
