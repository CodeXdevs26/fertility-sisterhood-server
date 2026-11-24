import {
  ok,
  op,
  paged,
  pageParams,
  queryParam,
  ref,
} from "../../docs/helpers.js";

const tag = "Payments";

export const paymentSwagger = {
  tag: {
    name: tag,
    description:
      "In-app purchase transactions, saved from RevenueCat webhook events (one row per store transaction). Records from before the RevenueCat migration have `store: STRIPE`.",
  },
  paths: {
    "/payments": {
      get: op({
        tag,
        summary: "List transactions",
        description:
          "Newest first. `auth` is `null` when the payment could not be linked to a user. Refunds set status `REFUNDED` and `amountRefunded`.",
        access: "admin",
        parameters: [
          ...pageParams,
          queryParam(
            "searchTerm",
            "Case-insensitive match on user name or email"
          ),
          queryParam("status", "Filter by status", ref("PaymentStatus")),
        ],
        responses: ok(
          "Payments fetched successfully!",
          paged("payments", ref("Payment"))
        ),
      }),
    },
  },
};
