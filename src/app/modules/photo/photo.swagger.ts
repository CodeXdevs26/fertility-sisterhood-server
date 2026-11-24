import { dateTime, obj, objectId, str } from "../../docs/fields.js";
import {
  formBody,
  idParam,
  ok,
  op,
  paged,
  pageParams,
  queryParam,
  ref,
} from "../../docs/helpers.js";

const tag = "Photos";

export const photoSwagger = {
  tag: { name: tag, description: "Progress photos by milestone (premium)" },
  paths: {
    "/photos": {
      post: op({
        tag,
        summary: "Upload a photo",
        description:
          "Send as `multipart/form-data`. Only JPEG, PNG and WebP up to 5 MB are accepted.",
        access: "user",
        premium: true,
        requestBody: formBody(
          obj(
            {
              file: {
                type: "string",
                format: "binary",
                description: "Image (jpeg, png, webp - max 5 MB)",
              },
              caption: str("Day of retrieval"),
              milestone: ref("PhotoMilestone"),
              date: dateTime(),
            },
            ["file", "caption", "milestone", "date"]
          )
        ),
        responses: ok("Photo added successfully!", ref("Photo"), 201),
        errors: [400],
      }),
      get: op({
        tag,
        summary: "List my photos",
        description:
          "List items are a short form: `id`, `caption`, `milestone`, `file`, `fileSize` and `date`. Use `GET /photos/{id}` for the full record.",
        access: "user",
        premium: true,
        parameters: [
          ...pageParams,
          queryParam("category", "Filter by milestone", ref("PhotoMilestone")),
        ],
        responses: ok(
          "Photos fetched successfully!",
          paged("photos", {
            type: "object",
            properties: {
              id: objectId("Photo id"),
              caption: { type: "string" },
              milestone: ref("PhotoMilestone"),
              file: { type: "string", format: "uri" },
              fileSize: { type: "integer" },
              date: dateTime(),
            },
          })
        ),
        errors: [422],
      }),
    },
    "/photos/{id}": {
      get: op({
        tag,
        summary: "Get a photo by id",
        access: "user",
        premium: true,
        parameters: [idParam()],
        responses: ok("Photo fetched successfully!", ref("Photo")),
        errors: [404],
      }),
      delete: op({
        tag,
        summary: "Delete a photo",
        description: "Also removes the file from S3.",
        access: "user",
        premium: true,
        parameters: [idParam()],
        responses: ok("Photo deleted successfully!", {
          type: "object",
          properties: { fileSize: { type: "integer" } },
        }),
        errors: [404],
      }),
    },
  },
};
