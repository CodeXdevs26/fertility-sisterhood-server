import { crud } from "../../docs/crud.js";
import { dateTime, obj, str } from "../../docs/fields.js";
import { idParam, ok, op, ref } from "../../docs/helpers.js";

const tag = "Medications";

const fields = {
  name: str("Gonal-F"),
  dose: str("150 IU"),
  frequency: str("Once daily"),
  type: str("Injection"),
  startDate: dateTime(),
  endDate: dateTime(),
  reminderTimes: {
    type: "array",
    maxItems: 12,
    items: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
    example: ["08:00", "20:00"],
    description:
      'Optional. Local times (HH:mm, 24h) in the user\'s timezone (saved at login). A push "Medication reminder" is sent at each time while the course is active (startDate..endDate). The push never contains the medication name (UK GDPR). Sending an empty array turns reminders off.',
  },
};

// reminderTimes is optional on create
const required = Object.keys(fields).filter(key => key !== "reminderTimes");

export const medicationSwagger = {
  tag: { name: tag, description: "Medication plan and daily intake tracking" },
  paths: {
    ...crud({
      tag,
      base: "/medications",
      noun: "Medication",
      plural: "Medications",
      listKey: "medications",
      listItem: "MedicationListItem",
      item: "Medication",
      hasSingle: true,
      createBody: obj(fields, required),
      updateBody: obj(fields),
      listDescription:
        "Each item includes `isTakenToday` (whether it was marked as taken today).",
    }),
    "/medications/{id}/taken": {
      patch: op({
        tag,
        summary: "Mark medication as taken today",
        description:
          "Idempotent - if already marked today, the existing record is returned. No request body.",
        access: "user",
        parameters: [idParam()],
        responses: ok(
          "Medication marked as taken for today!",
          ref("MedicationTakenRecord")
        ),
        errors: [404],
      }),
    },
  },
};
