import { crud } from "../../docs/crud.js";
import { dateTime, obj, optStr, str } from "../../docs/fields.js";

const tag = "Notes";

const fields = {
  title: str("Questions for clinic"),
  description: optStr("Ask about the protocol"),
  date: dateTime(),
  tags: {
    type: "array",
    items: { type: "string", minLength: 1 },
    default: [],
    example: ["clinic", "todo"],
  },
};

export const noteSwagger = {
  tag: { name: tag, description: "Personal notes with tags (premium)" },
  paths: crud({
    tag,
    base: "/notes",
    noun: "Note",
    plural: "Notes",
    listKey: "notes",
    item: "Note",
    premium: true,
    createBody: obj(fields, ["title", "date"]),
    updateBody: obj(fields),
  }),
};
