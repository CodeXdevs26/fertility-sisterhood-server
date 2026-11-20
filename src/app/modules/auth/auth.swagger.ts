import { dateTime, obj, optStr, str } from "../../docs/fields.js";
import {
  ID_EXAMPLE,
  idParam,
  jsonBody,
  ok,
  op,
  paged,
  pageParams,
  queryParam,
  ref,
} from "../../docs/helpers.js";

const tag = "Auth";

const email = {
  type: "string",
  format: "email",
  example: "jane@example.com",
  description: "Trimmed and lower-cased by the server",
};
const password = {
  type: "string",
  format: "password",
  minLength: 7,
  example: "Secret@123",
  description:
    "Min 7 chars, at least one uppercase letter, one number and one special character",
};

export const authSwagger = {
  tag: {
    name: tag,
    description: "Signup, login, tokens, passwords and user management",
  },
  paths: {
    "/auth/signup": {
      post: op({
        tag,
        summary: "Register a new user",
        description:
          "Creates the account with status `PENDING` and emails a 6-digit OTP (valid for 2 minutes). Verify it with `POST /otp/verify` (`purpose: VERIFY_ACCOUNT`) to activate the account.",
        requestBody: jsonBody(
          obj({ email, password, name: str("Jane Doe") }, [
            "email",
            "password",
            "name",
          ])
        ),
        responses: ok("Signup successful!", ref("User"), 201),
        errors: [400],
      }),
    },
    "/auth/login": {
      post: op({
        tag,
        summary: "Login with email and password",
        description:
          "Returns an access token in the body and sets the refresh token in the `player-centralRefreshToken` httpOnly cookie. Fails with 400 if the account is `PENDING`, `BLOCKED`, `DELETED` or was created with Google.",
        requestBody: jsonBody(
          obj(
            {
              email,
              password,
              fcmToken: optStr(
                "fcm-device-token",
                "Push notification token (optional)"
              ),
              isMobileApp: { type: "boolean", default: false },
            },
            ["email", "password"]
          )
        ),
        responses: ok("Logged in successfully!", {
          type: "object",
          properties: {
            accessToken: { type: "string", example: "eyJhbGciOiJIUzI1NiIs..." },
          },
        }),
        errors: [400],
      }),
    },
    "/auth/refresh-token": {
      get: op({
        tag,
        summary: "Get a new access token",
        description:
          "Reads the refresh token from the `player-centralRefreshToken` cookie (set at login). No request body or Authorization header is needed.",
        responses: ok("Token refreshed successfully!", {
          type: "object",
          properties: {
            accessToken: { type: "string", example: "eyJhbGciOiJIUzI1NiIs..." },
          },
        }),
        errors: [401, 404],
      }),
    },
    "/auth/reset-password": {
      post: op({
        tag,
        summary: "Reset forgotten password",
        description:
          "Flow: `POST /otp/send` (`RESET_PASSWORD`) -> `POST /otp/verify` (returns `resetToken`, valid 10 minutes) -> this endpoint.",
        requestBody: jsonBody(
          obj(
            {
              email,
              password: { ...password, description: "The new password" },
              resetToken: str("a3f5...c9", "Token returned by /otp/verify"),
            },
            ["email", "password", "resetToken"]
          )
        ),
        responses: ok("Password reset successfully!"),
        errors: [401, 404],
      }),
    },
    "/auth/change-password": {
      post: op({
        tag,
        summary: "Change my password",
        access: "any",
        requestBody: jsonBody(
          obj({ oldPassword: password, newPassword: password }, [
            "oldPassword",
            "newPassword",
          ])
        ),
        responses: ok("Password changed successfully!"),
        errors: [400, 404],
      }),
    },
    "/auth/change-account-status/{userId}": {
      patch: op({
        tag,
        summary: "Activate, block or delete a user",
        description: "Admin accounts cannot be changed (400).",
        access: "admin",
        parameters: [idParam("userId", "Id of the user to change")],
        requestBody: jsonBody(
          obj({
            status: {
              type: "string",
              enum: ["ACTIVE", "BLOCKED", "DELETED"],
              default: "ACTIVE",
            },
          })
        ),
        responses: ok("Account blocked successfully!", {
          type: "object",
          properties: {
            message: {
              type: "string",
              example: "Account blocked successfully!",
            },
          },
        }),
        errors: [400, 404],
      }),
    },
    "/auth/logout": {
      post: op({
        tag,
        summary: "Logout",
        description: "Clears the refresh token cookie.",
        access: "admin",
        responses: ok("Logged out successfully!"),
      }),
    },
    "/auth": {
      get: op({
        tag,
        summary: "List users",
        description: "Lists `USER` accounts with status `ACTIVE` or `BLOCKED`.",
        access: "admin",
        parameters: [
          ...pageParams,
          queryParam("searchTerm", "Case-insensitive match on name or email"),
          queryParam("status", "Filter by status", {
            type: "string",
            enum: ["ACTIVE", "BLOCKED"],
          }),
          queryParam(
            "sortBy",
            "Field to sort by, e.g. `createdAt` (needs `orderBy`)"
          ),
          queryParam("orderBy", "Sort direction (needs `sortBy`)", {
            type: "string",
            enum: ["asc", "desc"],
          }),
          queryParam("role", "Comma separated roles, e.g. `USER`"),
        ],
        responses: ok(
          "Users retrieved successfully!",
          paged("auths", ref("User"))
        ),
      }),
    },
    "/auth/{id}": {
      get: op({
        tag,
        summary: "Get a user by id",
        access: "admin",
        parameters: [idParam("id", "User id")],
        responses: ok("User retrieved successfully!", {
          allOf: [
            ref("User"),
            {
              type: "object",
              properties: {
                subscription: {
                  type: "object",
                  nullable: true,
                  properties: {
                    status: ref("SubscriptionStatus"),
                    cancelAtPeriodEnd: { type: "boolean" },
                    currentPeriodEnd: { ...dateTime(), nullable: true },
                    createdAt: dateTime(),
                  },
                },
              },
            },
          ],
          example: { id: ID_EXAMPLE },
        }),
        errors: [404],
      }),
    },
  },
};
