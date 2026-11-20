import { obj, str } from "../../docs/fields.js";
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

const tag = "Support";

const supportWithUser = {
  allOf: [
    ref("Support"),
    {
      type: "object",
      properties: {
        auth: {
          type: "object",
          nullable: true,
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            email: { type: "string", format: "email" },
            status: ref("UserStatus"),
          },
        },
      },
    },
  ],
};

export const supportSwagger = {
  tag: {
    name: tag,
    description: "Support requests from users, handled by admins",
  },
  paths: {
    "/support": {
      post: op({
        tag,
        summary: "Send a support request",
        access: "user",
        requestBody: jsonBody(
          obj(
            {
              title: str("Cannot upload photo"),
              description: str("I get an error when uploading a photo..."),
            },
            ["title", "description"]
          )
        ),
        responses: ok(
          "Support request sent successfully!",
          ref("Support"),
          201
        ),
      }),
      get: op({
        tag,
        summary: "List all support requests",
        access: "admin",
        parameters: [
          ...pageParams,
          queryParam("searchTerm", "Search in title and description"),
        ],
        responses: ok(
          "Support requests fetched successfully!",
          paged("supports", supportWithUser)
        ),
      }),
    },
    "/support/{id}": {
      get: op({
        tag,
        summary: "Get a support request",
        access: "admin",
        parameters: [idParam()],
        responses: ok("Support request fetched successfully!", supportWithUser),
        errors: [404],
      }),
    },
    "/support/{id}/status": {
      patch: op({
        tag,
        summary: "Update support request status",
        access: "admin",
        parameters: [idParam()],
        requestBody: jsonBody(
          obj({ status: ref("SupportStatus") }, ["status"])
        ),
        responses: ok(
          "Support request status updated successfully!",
          ref("Support")
        ),
        errors: [404],
      }),
    },
  },
};
