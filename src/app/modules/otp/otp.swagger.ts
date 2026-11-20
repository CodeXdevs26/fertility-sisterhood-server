import { obj } from "../../docs/fields.js";
import { jsonBody, ok, op, ref } from "../../docs/helpers.js";

const tag = "OTP";

const email = {
  type: "string",
  format: "email",
  example: "jane@example.com",
};

export const otpSwagger = {
  tag: {
    name: tag,
    description:
      "One-time passwords for account verification and password reset",
  },
  paths: {
    "/otp/send": {
      post: op({
        tag,
        summary: "Send an OTP by email",
        description:
          "The OTP is 6 digits and valid for 5 minutes. If `purpose` is missing or invalid it defaults to `VERIFY_ACCOUNT`. This endpoint does not run body validation, so `email` must be sent.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: obj(
                {
                  email,
                  purpose: {
                    ...ref("OTPPurpose"),
                    description: "Defaults to VERIFY_ACCOUNT",
                  },
                },
                ["email"]
              ),
            },
          },
        },
        responses: ok("OTP sent successfully!"),
        errors: [404],
      }),
    },
    "/otp/verify": {
      post: op({
        tag,
        summary: "Verify an OTP",
        description:
          "`VERIFY_ACCOUNT` activates the account and returns an `accessToken`. `RESET_PASSWORD` returns a `resetToken` (valid 10 minutes) for `POST /auth/reset-password`. More than 3 failed attempts or an expired OTP returns 400.",
        requestBody: jsonBody(
          obj(
            {
              email,
              otp: {
                type: "string",
                minLength: 6,
                maxLength: 6,
                example: "123456",
              },
              purpose: ref("OTPPurpose"),
            },
            ["email", "otp", "purpose"]
          )
        ),
        responses: ok("OTP verified successfully!", {
          type: "object",
          description:
            "`accessToken` for VERIFY_ACCOUNT, `resetToken` for RESET_PASSWORD",
          properties: {
            accessToken: { type: "string", example: "eyJhbGciOiJIUzI1NiIs..." },
            resetToken: { type: "string", example: "a3f5c9..." },
          },
        }),
        errors: [400, 404],
      }),
    },
  },
};
