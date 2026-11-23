import { obj, str } from "../../docs/fields.js";
import {
  idParam,
  jsonBody,
  ok,
  op,
  queryParam,
  ref,
} from "../../docs/helpers.js";

const tag = "Checklist Template";
const title = { ...str("Book initial fertility consultation"), maxLength: 200 };

export const checklistTemplateSwagger = {
  tag: {
    name: tag,
    description:
      "Admin-managed default items of the pre-treatment IVF checklist. Users' own ticks and custom items live in `/checklists`.",
  },
  paths: {
    "/checklist-templates": {
      get: op({
        tag,
        summary: "List template items",
        description:
          "Not paginated. Sorted by category (enum order) then `order`; with `category`, only that category.",
        access: "any",
        parameters: [
          queryParam(
            "category",
            "Only this category",
            ref("ChecklistCategory")
          ),
        ],
        responses: ok("Checklist template fetched successfully!", {
          type: "array",
          items: ref("ChecklistTemplateItem"),
        }),
        errors: [400],
      }),
      post: op({
        tag,
        summary: "Add template item",
        description: "`order` is set to last + 1 within the category.",
        access: "admin",
        requestBody: jsonBody(
          obj({ category: ref("ChecklistCategory"), title }, [
            "category",
            "title",
          ])
        ),
        responses: ok(
          "Checklist template item created successfully!",
          ref("ChecklistTemplateItem"),
          201
        ),
      }),
    },
    "/checklist-templates/{id}": {
      patch: op({
        tag,
        summary: "Update template item",
        description: "Moving to another category puts the item last in it.",
        access: "admin",
        parameters: [idParam()],
        requestBody: jsonBody(
          obj({ category: ref("ChecklistCategory"), title })
        ),
        responses: ok(
          "Checklist template item updated successfully!",
          ref("ChecklistTemplateItem")
        ),
        errors: [404],
      }),
      delete: op({
        tag,
        summary: "Delete template item",
        description: "Deletes the template only; users keep their own copies.",
        access: "admin",
        parameters: [idParam()],
        responses: ok(
          "Checklist template item deleted successfully!",
          ref("ChecklistTemplateItem")
        ),
        errors: [404],
      }),
    },
  },
};
