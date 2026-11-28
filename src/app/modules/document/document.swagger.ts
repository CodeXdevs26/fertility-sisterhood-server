import { dateTime, obj, optStr } from "../../docs/fields.js";
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

const tag = "Documents";

const file = {
  type: "string",
  format: "binary",
  description: "Any file type. Uploaded to S3 (form field name: `file`).",
};
const fields = {
  date: dateTime("Optional"),
  note: optStr("Blood test report"),
};

export const documentSwagger = {
  tag: { name: tag, description: "Medical document uploads (premium)" },
  paths: {
    "/documents": {
      post: op({
        tag,
        summary: "Upload a document",
        description:
          "Send as `multipart/form-data`. The `file` part is required; other fields may be sent flat or as a `payload` JSON string.",
        access: "user",
        premium: true,
        requestBody: formBody(obj({ file, ...fields }, ["file"])),
        responses: ok("Document uploaded successfully!", ref("Document"), 201),
        errors: [400],
      }),
      get: op({
        tag,
        summary: "List my documents",
        access: "user",
        premium: true,
        parameters: [
          ...pageParams,
          queryParam("date", "Only documents of this day", {
            type: "string",
            format: "date",
            example: "2026-01-15",
          }),
        ],
        responses: ok(
          "Documents fetched successfully!",
          paged("documents", ref("Document"))
        ),
        errors: [422],
      }),
    },
    "/documents/{id}": {
      patch: op({
        tag,
        summary: "Update a document",
        description:
          "Send as `multipart/form-data`. All parts optional (fields flat or as a `payload` JSON string); sending a new `file` replaces the old one.",
        access: "user",
        premium: true,
        parameters: [idParam()],
        requestBody: formBody(obj({ file, ...fields }), false),
        responses: ok("Document updated successfully!", ref("Document")),
        errors: [400, 404],
      }),
      delete: op({
        tag,
        summary: "Delete a document",
        access: "user",
        premium: true,
        parameters: [idParam()],
        responses: ok("Document deleted successfully!", ref("Document")),
        errors: [404],
      }),
    },
  },
};
