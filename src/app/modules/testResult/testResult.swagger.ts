import { crud } from "../../docs/crud.js";
import { dateTime, obj, optStr, str } from "../../docs/fields.js";
import {
  formBody,
  idParam,
  ok,
  op,
  queryParam,
  ref,
} from "../../docs/helpers.js";

const tag = "Test Results";

const fields = {
  category: str("Hormone"),
  name: str("AMH"),
  date: dateTime(),
  value: str("2.1"),
  unit: optStr("ng/mL", "Optional. Send an empty string to clear it."),
  note: optStr("Fasting sample"),
};

export const testResultSwagger = {
  tag: { name: tag, description: "Lab and test results (premium)" },
  paths: {
    ...crud({
      tag,
      base: "/test-results",
      noun: "Test result",
      plural: "Test results",
      listKey: "testResults",
      item: "TestResult",
      premium: true,
      hasSingle: true,
      createBody: obj(fields, ["name", "date", "value"]),
      updateBody: obj(fields),
      listQuery: [
        queryParam("category", "Filter by exact category, e.g. `Hormone`"),
      ],
    }),
    "/test-results/{id}/attachment": {
      post: op({
        tag,
        summary: "Attach a file to a test result",
        description:
          "Send as `multipart/form-data`. PDF, JPG, PNG, WEBP or HEIC, max 10 MB. Replaces any existing attachment. Returns the updated test result.",
        access: "user",
        premium: true,
        parameters: [idParam()],
        requestBody: formBody(
          obj(
            {
              attachment: {
                type: "string",
                format: "binary",
                description: "PDF/JPG/PNG/WEBP/HEIC, max 10 MB",
              },
            },
            ["attachment"]
          )
        ),
        responses: ok("Attachment uploaded successfully!", ref("TestResult")),
        errors: [400, 404],
      }),
      delete: op({
        tag,
        summary: "Remove the attachment of a test result",
        access: "user",
        premium: true,
        parameters: [idParam()],
        responses: ok("Attachment removed successfully!", ref("TestResult")),
        errors: [404],
      }),
    },
  },
};
