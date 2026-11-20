import { obj, str } from "../../docs/fields.js";
import { jsonBody, ok, op, ref } from "../../docs/helpers.js";

const tag = "Profile";

export const profileSwagger = {
  tag: { name: tag, description: "Logged-in user's own profile" },
  paths: {
    "/profile": {
      get: op({
        tag,
        summary: "Get my profile",
        description:
          "`isPremiumUser` is true when the subscription is `ACTIVE`.",
        access: "any",
        responses: ok("Profile fetched successfully!", ref("Profile")),
        errors: [404],
      }),
      patch: op({
        tag,
        summary: "Update my profile",
        access: "any",
        requestBody: jsonBody(obj({ name: str("Jane Doe") })),
        responses: ok("Profile updated successfully!", ref("Profile")),
        errors: [404],
      }),
    },
  },
};
