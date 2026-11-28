import { dateTime, obj, optStr, str } from "../../docs/fields.js";
import {
  idParam,
  jsonBody,
  ok,
  op,
  paged,
  pageParams,
  queryParam,
  ref,
} from "../../docs/helpers.js";

const tag = "Checklists";

const fields = {
  title: str("Book blood test"),
  category: ref("ChecklistCategory"),
  date: dateTime(
    "Calendar day (send YYYY-MM-DD). Defaults to the user's local today."
  ),
  description: optStr("Call the clinic before 5pm"),
};

export const checklistSwagger = {
  tag: {
    name: tag,
    description:
      "Daily to-do checklist (premium). The first time a user opens their checklist (`GET /checklists` or `/checklists/today`), the admin's default items (Checklist templates) are copied into it once, dated today (re-seeded if the user has no items). Every item carries `isCompleted` (true when `status` is COMPLETED).",
  },
  paths: {
    "/checklists": {
      post: op({
        tag,
        summary: "Create checklist item",
        access: "user",
        premium: true,
        requestBody: jsonBody(obj(fields, ["title", "category"])),
        responses: ok(
          "Checklist item created successfully!",
          {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              category: ref("ChecklistCategory"),
              date: dateTime(),
              status: ref("ChecklistStatus"),
              isCompleted: { type: "boolean" },
            },
          },
          201
        ),
      }),
      get: op({
        tag,
        summary: "List my checklist",
        description:
          "All items, oldest day first. Filter by `category`, `status` and/or one calendar `date`.",
        access: "user",
        premium: true,
        parameters: [
          ...pageParams,
          queryParam(
            "category",
            "Filter by category",
            ref("ChecklistCategory")
          ),
          queryParam("status", "Filter by status", ref("ChecklistStatus")),
          queryParam("date", "One calendar day, e.g. 2026-05-01", {
            type: "string",
            format: "date",
          }),
        ],
        responses: ok(
          "Checklist fetched successfully!",
          paged("checklists", {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              category: ref("ChecklistCategory"),
              date: dateTime(),
              description: { type: "string", nullable: true },
              status: ref("ChecklistStatus"),
              isCompleted: { type: "boolean" },
            },
          })
        ),
        errors: [422],
      }),
    },
    "/checklists/today": {
      get: op({
        tag,
        summary: "List my persistent checklist for today",
        description:
          "Returns every item dated on or before today (so unfinished items carry over), sorted by category. Default `limit` is 100. \"Today\" is the `date` query (the app's local date) or, if omitted, the user's timezone day (`Auth.timezone`, default Europe/London). Each item: `id`, `title`, `category`, `date`, `description`, `status`, `isCompleted`.",
        access: "user",
        premium: true,
        parameters: [
          ...pageParams,
          queryParam("date", "The app's local date, YYYY-MM-DD", {
            type: "string",
            format: "date",
            example: "2026-05-01",
          }),
          queryParam(
            "category",
            "Filter by category",
            ref("ChecklistCategory")
          ),
        ],
        responses: ok(
          "Today's checklist fetched successfully!",
          paged("checklists", ref("ChecklistListItem"))
        ),
        errors: [422],
      }),
    },
    "/checklists/{id}/done": {
      patch: op({
        tag,
        summary: "Mark checklist item as completed",
        description: "No request body.",
        access: "user",
        premium: true,
        parameters: [idParam()],
        responses: ok(
          "Checklist item marked as completed!",
          ref("ChecklistListItem")
        ),
        errors: [404],
      }),
    },
    "/checklists/{id}": {
      patch: op({
        tag,
        summary: "Update checklist item",
        description:
          "All fields optional. `isCompleted: true` sets status COMPLETED, `false` sets PENDING.",
        access: "user",
        premium: true,
        parameters: [idParam()],
        requestBody: jsonBody(
          obj({
            ...fields,
            status: ref("ChecklistStatus"),
            isCompleted: { type: "boolean", example: true },
          })
        ),
        responses: ok("Checklist item updated successfully!", ref("Checklist")),
        errors: [404],
      }),
      delete: op({
        tag,
        summary: "Delete checklist item",
        access: "user",
        premium: true,
        parameters: [idParam()],
        responses: ok("Checklist item deleted successfully!", ref("Checklist")),
        errors: [404],
      }),
    },
  },
};
