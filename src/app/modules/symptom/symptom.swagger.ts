import { crud } from "../../docs/crud.js";
import { dateTime, obj, optStr } from "../../docs/fields.js";
import { ok, op, ref } from "../../docs/helpers.js";

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
        "Only one symptom per day - a second one for the same day returns 409.",
    }),
    "/symptoms/today": {
      get: op({
        tag,
        summary: "Get today's symptom",
        description: "`data` is `null` if nothing was logged today.",
        access: "user",
        premium: true,
        responses: ok("Today's symptom fetched successfully!", {
          ...ref("Symptom"),
          nullable: true,
        }),
      }),
    },
  },
};
