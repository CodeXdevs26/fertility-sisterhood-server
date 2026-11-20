import { crud } from "../../docs/crud.js";
import { dateTime, obj, optStr, str } from "../../docs/fields.js";
import { queryParam } from "../../docs/helpers.js";

const tag = "Test Results";

const fields = {
  category: str("Hormone"),
  name: str("AMH"),
  date: dateTime(),
  value: str("2.1"),
  unit: str("ng/mL"),
  note: optStr("Fasting sample"),
};

export const testResultSwagger = {
  tag: { name: tag, description: "Lab and test results (premium)" },
  paths: crud({
    tag,
    base: "/test-results",
    noun: "Test result",
    plural: "Test results",
    listKey: "testResults",
    item: "TestResult",
    premium: true,
    hasSingle: true,
    createBody: obj(fields, ["name", "date", "value", "unit"]),
    updateBody: obj(fields),
    listQuery: [
      queryParam("category", "Filter by exact category, e.g. `Hormone`"),
    ],
  }),
};
