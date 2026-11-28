import { crud } from "../../docs/crud.js";
import { dateTime, obj, optStr } from "../../docs/fields.js";
import { ok, op, queryParam, ref } from "../../docs/helpers.js";

const tag = "Symptoms";

const fields = {
  symptomName: ref("SymptomName"),
  moods: { type: "array", items: ref("Mood"), default: [] },
  note: optStr("Felt tired after work"),
  date: dateTime("Defaults to now. Only one symptom entry per day is allowed."),
};

export const symptomSwagger = {
  tag: { name: tag, description: "Daily symptom and mood log (premium)" },
  paths: {
    ...crud({
      tag,
      base: "/symptoms",
      noun: "Symptom",
      plural: "Symptoms",
      listKey: "symptoms",
      item: "Symptom",
      premium: true,
      createBody: obj(fields, ["symptomName"]),
      updateBody: obj(fields),
      createDescription:
        "One entry per day: posting for a day that already has an entry updates it (200) instead of creating a new one (201).",
    }),
    "/symptoms/today": {
      get: op({
        tag,
        summary: "Get today's symptom",
        description: "`data` is `null` if nothing was logged today.",
        access: "user",
        premium: true,
        parameters: [
          queryParam("date", "The app's local date, YYYY-MM-DD", {
            type: "string",
            format: "date",
          }),
        ],
        responses: ok("Today's symptom fetched successfully!", {
          ...ref("Symptom"),
          nullable: true,
        }),
      }),
    },
  },
};
