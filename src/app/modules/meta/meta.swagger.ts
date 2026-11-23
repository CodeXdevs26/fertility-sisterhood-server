import { ok, op, queryParam } from "../../docs/helpers.js";

const tag = "Meta";

export const metaSwagger = {
  tag: { name: tag, description: "Admin dashboard statistics" },
  paths: {
    "/meta/stats": {
      get: op({
        tag,
        summary: "Dashboard counters",
        access: "admin",
        responses: ok("Stats fetched successfully!", {
          type: "object",
          properties: {
            totalUsers: { type: "integer", example: 120 },
            activeUsers: { type: "integer", example: 110 },
            blockedUsers: { type: "integer", example: 10 },
            activeSubscribers: { type: "integer", example: 45 },
            newUsersThisMonth: {
              type: "integer",
              example: 85,
              description: "ACTIVE/BLOCKED users created since the 1st (UTC)",
            },
            totalRevenue: {
              type: "number",
              example: 15230.5,
              description: "EUR, succeeded payments minus refunds",
            },
            revenueThisMonth: { type: "number", example: 2040 },
            pendingSupports: { type: "integer", example: 7 },
          },
        }),
      }),
    },
    "/meta/earning-overview": {
      get: op({
        tag,
        summary: "Revenue per month (EUR)",
        description:
          "Returns all 12 months (amount is 0 for empty months). Succeeded payments minus refunds, by payment date (UTC).",
        access: "admin",
        parameters: [
          queryParam("year", "Year to report (default: current UTC year)", {
            type: "integer",
            example: 2026,
          }),
        ],
        responses: ok("Earning overview fetched successfully!", {
          type: "array",
          items: {
            type: "object",
            properties: {
              month: { type: "string", example: "Jan" },
              amount: { type: "number", example: 1200 },
            },
          },
        }),
      }),
    },
    "/meta/user-overview": {
      get: op({
        tag,
        summary: "New users per month",
        description:
          "Returns all 12 months of the year (count is 0 for empty months).",
        access: "admin",
        parameters: [
          queryParam("year", "Year to report (default: current UTC year)", {
            type: "integer",
            example: 2026,
          }),
          queryParam(
            "status",
            "Count only this status (default: ACTIVE + BLOCKED)",
            {
              type: "string",
              enum: ["ACTIVE", "BLOCKED"],
            }
          ),
        ],
        responses: ok("User overview fetched successfully!", {
          type: "array",
          items: {
            type: "object",
            properties: {
              month: { type: "string", example: "Jan" },
              count: { type: "integer", example: 8 },
            },
          },
        }),
      }),
    },
  },
};
