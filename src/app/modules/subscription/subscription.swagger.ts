import { obj, str } from "../../docs/fields.js";
import { jsonBody, ok, op, ref } from "../../docs/helpers.js";

const tag = "Subscriptions";

export const subscriptionSwagger = {
  tag: {
    name: tag,
    description: "Premium plan and Stripe subscription (EUR, monthly)",
  },
  paths: {
    "/subscriptions/plan": {
      get: op({
        tag,
        summary: "Get the subscription plan",
        description: "`data` is `null` until an admin creates the plan.",
        access: "any",
        responses: ok("Subscription plan fetched successfully!", {
          ...ref("SubscriptionPlan"),
          nullable: true,
        }),
      }),
      patch: op({
        tag,
        summary: "Create or update the subscription plan",
        description:
          "Upsert - creates the Stripe product and price on first call. Changing `price` creates a new Stripe price and deactivates the old one.",
        access: "admin",
        requestBody: jsonBody(
          obj(
            {
              title: str("Premium"),
              description: str("Unlock all tracking features"),
              price: {
                type: "number",
                exclusiveMinimum: 0,
                example: 9.99,
                description: "Monthly price in EUR",
              },
            },
            ["title", "description", "price"]
          )
        ),
        responses: ok(
          "Subscription plan updated successfully!",
          ref("SubscriptionPlan")
        ),
      }),
    },
    "/subscriptions/purchase": {
      post: op({
        tag,
        summary: "Start a subscription",
        description:
          "Creates an incomplete Stripe subscription. Use the returned values with the Stripe PaymentSheet; the subscription becomes `ACTIVE` through the webhook. No request body. Fails with 400 if already active.",
        access: "user",
        responses: ok(
          "Subscription initiated successfully!",
          ref("PurchaseResult"),
          201
        ),
        errors: [400, 404],
      }),
    },
    "/subscriptions/my": {
      get: op({
        tag,
        summary: "Get my subscription",
        access: "user",
        responses: ok(
          "Subscription fetched successfully!",
          ref("MySubscription")
        ),
      }),
    },
    "/subscriptions/cancel": {
      patch: op({
        tag,
        summary: "Cancel auto-renew",
        description:
          "Sets cancel-at-period-end - premium stays until `endDate`. No request body.",
        access: "user",
        responses: ok(
          "Subscription canceled successfully!",
          ref("MySubscription")
        ),
        errors: [400, 404],
      }),
    },
    "/subscriptions/renew": {
      patch: op({
        tag,
        summary: "Turn auto-renew back on",
        description: "No request body.",
        access: "user",
        responses: ok(
          "Subscription renewed successfully!",
          ref("MySubscription")
        ),
        errors: [400, 404],
      }),
    },
    "/subscriptions/webhook": {
      post: op({
        tag,
        summary: "Stripe webhook",
        description:
          "Called by Stripe only. The body is the raw event JSON and the `stripe-signature` header is verified. Handles `customer.subscription.created|updated|deleted`.",
        parameters: [
          {
            name: "stripe-signature",
            in: "header",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", description: "Raw Stripe event" },
            },
          },
        },
        responses: ok("Webhook received successfully!"),
        errors: [400],
      }),
    },
  },
};
