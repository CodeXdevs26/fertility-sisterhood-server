import { obj, str } from "../../docs/fields.js";
import {
  idParam,
  jsonBody,
  ok,
  op,
  queryParam,
  ref,
} from "../../docs/helpers.js";

const tag = "Packages";

const fields = {
  title: { ...str("Premium Monthly"), maxLength: 100 },
  billingCycle: ref("BillingCycle"),
  revenueCatProductId: str(
    "premium_monthly",
    "Store product id exactly as RevenueCat reports it (`product_id`)"
  ),
  entitlementId: str("premium", "RevenueCat entitlement this product unlocks"),
  description: {
    type: "array",
    items: { type: "string" },
    maxItems: 20,
    example: ["All trackers", "Morning digest"],
  },
  price: {
    type: "number",
    exclusiveMinimum: 0,
    example: 9.99,
    description: "Display price; the store sets the real price",
  },
  currency: {
    type: "string",
    minLength: 3,
    maxLength: 3,
    example: "gbp",
    description: "ISO code, saved lowercase (default `gbp`)",
  },
};

export const packageSwagger = {
  tag: {
    name: tag,
    description:
      "Purchasable plans. Each maps a RevenueCat product to the entitlement it unlocks.",
  },
  paths: {
    "/packages": {
      get: op({
        tag,
        summary: "List packages",
        description:
          "Cheapest first. Users only see packages that are not deleted.",
        access: "any",
        parameters: [
          queryParam(
            "includeDeleted",
            "Admin only: `true` also returns soft-deleted packages",
            { type: "boolean" }
          ),
        ],
        responses: ok("Packages fetched successfully!", {
          type: "array",
          items: ref("Package"),
        }),
      }),
      post: op({
        tag,
        summary: "Create package",
        access: "admin",
        requestBody: jsonBody(
          obj(fields, [
            "title",
            "billingCycle",
            "revenueCatProductId",
            "entitlementId",
            "price",
          ])
        ),
        responses: ok("Package created successfully!", ref("Package"), 201),
        errors: [409],
      }),
    },
    "/packages/{id}": {
      get: op({
        tag,
        summary: "Get package by id",
        description: "Users get 404 for a deleted package.",
        access: "any",
        parameters: [idParam()],
        responses: ok("Package fetched successfully!", ref("Package")),
        errors: [404],
      }),
      patch: op({
        tag,
        summary: "Update package",
        description:
          "All body fields are optional - send only what changes. A deleted package returns 404 unless the body has `isDeleted: false`, which restores it.",
        access: "admin",
        parameters: [idParam()],
        requestBody: jsonBody(
          obj({
            ...fields,
            isDeleted: {
              type: "boolean",
              enum: [false],
              description: "`false` restores a soft-deleted package",
            },
          })
        ),
        responses: ok("Package updated successfully!", ref("Package")),
        errors: [404, 409],
      }),
      delete: op({
        tag,
        summary: "Delete package",
        description:
          "Soft delete (`isDeleted: true`). Hidden from users; existing subscribers keep it.",
        access: "admin",
        parameters: [idParam()],
        responses: ok("Package deleted successfully!", ref("Package")),
        errors: [404],
      }),
    },
  },
};
