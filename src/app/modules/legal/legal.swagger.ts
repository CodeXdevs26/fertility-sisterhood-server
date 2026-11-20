import { obj, str } from "../../docs/fields.js";
import { jsonBody, ok, op, ref } from "../../docs/helpers.js";

const tag = "Legal";

export const legalSwagger = {
  tag: { name: tag, description: "Privacy policy, terms and about us" },
  paths: {
    "/legal": {
      get: op({
        tag,
        summary: "Get legal content",
        description:
          "`data` is `null` until an admin saves it for the first time.",
        responses: ok("Legal data retrieved successfully!", {
          ...ref("Legal"),
          nullable: true,
        }),
      }),
      patch: op({
        tag,
        summary: "Create or update legal content",
        description:
          "Upsert - creates the single legal record if it does not exist.",
        access: "admin",
        requestBody: jsonBody(
          obj(
            {
              privacyPolicy: str("Our privacy policy ..."),
              termsCondition: str("Our terms and conditions ..."),
              aboutUs: str("About Fertility Sisterhood ..."),
            },
            ["privacyPolicy", "termsCondition", "aboutUs"]
          )
        ),
        responses: ok("Legal data updated successfully!", ref("Legal")),
      }),
    },
  },
};
