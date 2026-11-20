import { crud } from "../../docs/crud.js";
import { obj, str } from "../../docs/fields.js";

const tag = "Journals";

const fields = {
  title: str("Day 3 of stims"),
  content: str("Feeling hopeful today..."),
};

export const journalSwagger = {
  tag: { name: tag, description: "Personal journal entries" },
  paths: crud({
    tag,
    base: "/journals",
    noun: "Journal entry",
    plural: "Journal entries",
    listKey: "journals",
    item: "Journal",
    createBody: obj(fields, ["title", "content"]),
    updateBody: obj(fields),
  }),
};
