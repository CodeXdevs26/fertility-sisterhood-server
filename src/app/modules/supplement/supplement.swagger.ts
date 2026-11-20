import { crud } from "../../docs/crud.js";
import { dateTime, obj, str } from "../../docs/fields.js";
import { idParam, ok, op, ref } from "../../docs/helpers.js";

const tag = "Supplements";

const fields = {
  name: str("Folic acid"),
  dose: str("400 mcg"),
  frequency: str("Once daily"),
  type: str("Tablet"),
  startDate: dateTime(),
  endDate: dateTime(),
};

export const supplementSwagger = {
  tag: {
    name: tag,
    description: "Supplement plan and daily intake tracking (premium)",
  },
  paths: {
    ...crud({
      tag,
      base: "/supplements",
      noun: "Supplement",
      plural: "Supplements",
      listKey: "supplements",
      listItem: "SupplementListItem",
      item: "Supplement",
      premium: true,
      hasSingle: true,
      createBody: obj(fields, Object.keys(fields)),
      updateBody: obj(fields),
      listDescription:
        "Each item includes `isTakenToday` (whether it was marked as taken today).",
    }),
    "/supplements/{id}/taken": {
      patch: op({
        tag,
        summary: "Mark supplement as taken today",
        description:
          "Idempotent - if already marked today, the existing record is returned. No request body.",
        access: "user",
        premium: true,
        parameters: [idParam()],
        responses: ok(
          "Supplement marked as taken for today!",
          ref("SupplementTakenRecord")
        ),
        errors: [404],
      }),
    },
  },
};
