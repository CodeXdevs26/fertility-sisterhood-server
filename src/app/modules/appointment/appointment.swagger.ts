import { crud } from "../../docs/crud.js";
import { dateTime, obj, str } from "../../docs/fields.js";

const tag = "Appointments";

const fields = {
  doctor: str("Dr. Smith"),
  description: {
    type: "string",
    nullable: true,
    example: "Follow-up scan",
  },
  date: dateTime(),
  time: str("10:30 AM"),
};

export const appointmentSwagger = {
  tag: { name: tag, description: "Doctor appointments" },
  paths: crud({
    tag,
    base: "/appointments",
    noun: "Appointment",
    plural: "Appointments",
    listKey: "appointments",
    item: "Appointment",
    hasSingle: true,
    createBody: obj(fields, ["doctor", "date", "time"]),
    updateBody: obj(fields),
  }),
};
