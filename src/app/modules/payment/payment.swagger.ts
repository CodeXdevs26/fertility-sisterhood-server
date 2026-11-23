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
      "Stripe subscription payments, saved from the `invoice.paid`, `invoice.payment_failed` and `charge.refunded` webhooks.",
  },
  paths: {
    "/payments": {
      get: op({
        tag,
        summary: "List transactions",
        description:
          "Newest first. `auth` is `null` when the payment could not be linked to a user. A partial refund keeps status `SUCCEEDED` and sets `amountRefunded`.",
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
