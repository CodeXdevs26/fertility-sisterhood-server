import { obj, objectId } from "../../docs/fields.js";
import { jsonBody, ok, op, ref } from "../../docs/helpers.js";

const tag = "Subscriptions";

export const subscriptionSwagger = {
  tag: {
    name: tag,
    description:
      "Premium via in-app purchases through RevenueCat. The app must call `Purchases.logIn(<user id>)` so RevenueCat's `app_user_id` is the user id. Purchases, cancel and renew happen in the store (see `managementUrl`); plans are listed under Packages.",
  },
  paths: {
    "/subscriptions/my": {
      get: op({
        tag,
        summary: "Get my subscription",
        description:
          "Reads the saved state. Call `POST /subscriptions/sync/revenuecat` first if the app just made a purchase.",
        access: "user",
        responses: ok(
          "Subscription fetched successfully!",
          ref("MySubscription")
        ),
      }),
    },
    "/subscriptions/sync/revenuecat": {
      post: op({
        tag,
        summary: "Sync my subscription from RevenueCat",
        description:
          "Fetches the subscriber from the RevenueCat REST API, saves the state and returns it. Call it right after a purchase or restore, or whenever a webhook may have been missed. Active entitlement = `ACTIVE`; otherwise `EXPIRED` (or `CANCELLED` if refunded, `BILLING_ISSUE` if a billing problem ended it). No request body.",
        access: "user",
        responses: ok(
          "Subscription synced successfully!",
          ref("MySubscription")
        ),
        errors: [502],
      }),
    },
    "/subscriptions/test-purchase": {
      post: op({
        tag,
        summary: "Simulate a purchase (QA only)",
        description:
          "Activates Premium without RevenueCat: `store: TEST_API`, expiry +1 month (MONTHLY) or +1 year (ANNUAL). Replaces any existing subscription of the user and records a payment through the same path as a real `INITIAL_PURCHASE` webhook (marked `SANDBOX`, so it is not counted as revenue). Returns 404 unless `ENABLE_TEST_PURCHASE=true` (always 404 when `NODE_ENV=production`).",
        access: "user",
        requestBody: jsonBody(
          obj({ packageId: objectId("Package to buy") }, ["packageId"])
        ),
        responses: ok(
          "Test purchase completed successfully!",
          ref("MySubscription"),
          201
        ),
        errors: [404],
      }),
    },
    "/subscriptions/webhook/revenuecat": {
      post: op({
        tag,
        summary: "RevenueCat webhook",
        description:
          "Called by RevenueCat only. The `Authorization` header must equal `REVENUECAT_WEBHOOK_SECRET` (a `Bearer ` prefix is allowed). For every event the user's state is re-read from the RevenueCat API (events can arrive out of order). Payments are recorded for `INITIAL_PURCHASE`, `RENEWAL`, `BILLING_ISSUE` (failed) and refunds (`CANCELLATION` with `cancel_reason: CUSTOMER_SUPPORT`), deduplicated by `transaction_id`. `CANCELLATION` alone only turns auto-renew off; Premium stays until `EXPIRATION`. Unknown or anonymous users are acknowledged with 200 and ignored.",
        parameters: [
          {
            name: "Authorization",
            in: "header",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: jsonBody({
          type: "object",
          description: "RevenueCat webhook payload (`{ api_version, event }`)",
        }),
        responses: ok("Webhook received successfully!"),
        errors: [400, 401],
      }),
    },
  },
};
