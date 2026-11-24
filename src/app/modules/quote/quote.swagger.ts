import { obj, str } from "../../docs/fields.js";
import {
  idParam,
  jsonBody,
  ok,
  op,
  paged,
  pageParams,
  ref,
} from "../../docs/helpers.js";

const tag = "Quotes";
const author = {
  type: "string",
  nullable: true,
  maxLength: 100,
  example: "Unknown",
};
const text = { ...str("Believe in the power of your body."), maxLength: 300 };

export const quoteSwagger = {
  tag: {
    name: tag,
    description: "Motivational quotes for the app home screen",
  },
  paths: {
    "/quotes/today": {
      get: op({
        tag,
        summary: "Quote of the day",
        description:
          "One active quote per UTC day, the same for everyone; rotates daily. `null` when there are no active quotes.",
        responses: ok("Quote of the day fetched successfully!", {
          ...ref("Quote"),
          nullable: true,
        }),
      }),
    },
    "/quotes": {
      get: op({
        tag,
        summary: "List quotes",
        description: "Newest first.",
        access: "admin",
        parameters: pageParams,
        responses: ok(
          "Quotes fetched successfully!",
          paged("quotes", ref("Quote"))
        ),
      }),
      post: op({
        tag,
        summary: "Create quote",
        description: "Saved with `isActive: true`.",
        access: "admin",
        requestBody: jsonBody(obj({ text, author }, ["text"])),
        responses: ok("Quote created successfully!", ref("Quote"), 201),
      }),
    },
    "/quotes/{id}": {
      patch: op({
        tag,
        summary: "Update quote",
        access: "admin",
        parameters: [idParam()],
        requestBody: jsonBody(
          obj({ text, author, isActive: { type: "boolean", example: false } })
        ),
        responses: ok("Quote updated successfully!", ref("Quote")),
        errors: [404],
      }),
      delete: op({
        tag,
        summary: "Delete quote",
        access: "admin",
        parameters: [idParam()],
        responses: ok("Quote deleted successfully!", ref("Quote")),
        errors: [404],
      }),
    },
  },
};
