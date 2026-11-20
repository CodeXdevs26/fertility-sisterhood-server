import { crud } from "../../docs/crud.js";
import { dateTime, obj, optStr } from "../../docs/fields.js";
import { ref } from "../../docs/helpers.js";

const tag = "Costs";

const fields = {
  amount: { type: "number", example: 1250.5 },
  date: dateTime(),
  isPaid: { type: "boolean", example: true },
  ivfRound: ref("CostIvfRound"),
  type: ref("CostType"),
  category: ref("CostCategory"),
  description: optStr("Initial consultation fee"),
};

export const costSwagger = {
  tag: { name: tag, description: "IVF cost tracker (premium)" },
  paths: crud({
    tag,
    base: "/costs",
    noun: "Cost",
    plural: "Costs",
    listKey: "costs",
    item: "Cost",
    premium: true,
    hasSingle: true,
    createBody: obj(fields, [
      "amount",
      "date",
      "isPaid",
      "ivfRound",
      "type",
      "category",
    ]),
    updateBody: obj(fields),
  }),
};
