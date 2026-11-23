import { obj, str } from "../../docs/fields.js";
import { jsonBody, ok, op, ref } from "../../docs/helpers.js";

const tag = "App Settings";

export const appSettingSwagger = {
  tag: {
    name: tag,
    description: "Support contact details and community link shown in the app",
  },
  paths: {
    "/app-settings": {
      get: op({
        tag,
        summary: "Get app settings",
        description:
          "`data` is `null` until an admin saves it for the first time.",
        responses: ok("App settings fetched successfully!", {
          ...ref("AppSetting"),
          nullable: true,
        }),
      }),
      patch: op({
        tag,
        summary: "Create or update app settings",
        description:
          "Upsert. All three fields are required. `supportPhone`: 6-20 characters of digits, spaces, `+ ( ) -`. `communityLink` must be an https URL.",
        access: "admin",
        requestBody: jsonBody(
          obj(
            {
              supportEmail: str("support@example.com"),
              supportPhone: str("+44 20 1234 5678"),
              communityLink: str("https://chat.whatsapp.com/abc123"),
            },
            ["supportEmail", "supportPhone", "communityLink"]
          )
        ),
        responses: ok("App settings updated successfully!", ref("AppSetting")),
      }),
    },
  },
};
