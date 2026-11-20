import { crud } from "../../docs/crud.js";
import { obj, objectId, str } from "../../docs/fields.js";

const tag = "Questions";

const fields = {
  appointmentId: objectId("Id of one of your appointments"),
  text: str("What is the success rate?"),
};

export const questionSwagger = {
  tag: {
    name: tag,
    description: "Questions to ask at an appointment (premium)",
  },
  paths: crud({
    tag,
    base: "/questions",
    noun: "Question",
    plural: "Questions",
    listKey: "questions",
    item: "Question",
    premium: true,
    createBody: obj(fields, ["appointmentId", "text"]),
    updateBody: obj(fields),
  }),
};
