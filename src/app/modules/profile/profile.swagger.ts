import { obj, optStr, str } from "../../docs/fields.js";

const bool = (example: boolean) => ({ type: "boolean", example });
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
        requestBody: jsonBody(
          obj({
            name: str("Jane Doe"),
            fcmToken: str(
              "fcm-device-token",
              "Current device push token (send it whenever it rotates)"
            ),
            timezone: str("Europe/London", "IANA timezone"),
          })
        ),
        responses: ok("Profile updated successfully!", ref("Profile")),
        errors: [404],
      }),
      delete: op({
        tag,
        summary: "Delete my account permanently",
        description:
          "UK GDPR right to erasure. Confirms with the password (required for email accounts, optional for Google sign-in accounts), then permanently deletes the account and all its data: trackers, uploaded documents and photos (also from S3), notifications, support requests and the subscription record. Payment records are kept for accounting but no longer linked to the user. The refresh cookie is cleared. **A store subscription is not cancelled**: the user must cancel it in the App Store / Play Store first. Admin accounts cannot be deleted.",
        access: "user",
        requestBody: jsonBody(
          obj({
            password: optStr(
              "Secret@123",
              "Current password. Required for email accounts, optional for Google sign-in accounts."
            ),
          })
        ),
        responses: ok("Account deleted successfully!"),
        errors: [400, 404, 429],
      }),
    },
    "/profile/consent": {
      patch: op({
        tag,
        summary: "Save or withdraw my consent",
        description:
          'Saves the "Your consent matters" choices. Send `healthData: false` to withdraw health-data consent. `healthDataUpdatedAt` changes only when `healthData` changes.',
        access: "user",
        requestBody: jsonBody(
          obj(
            {
              healthData: bool(true),
              marketing: bool(false),
              cookies: bool(true),
            },
            ["healthData", "marketing", "cookies"]
          )
        ),
        responses: ok("Consent saved successfully!", ref("Consent")),
        errors: [404],
      }),
    },
  },
};
