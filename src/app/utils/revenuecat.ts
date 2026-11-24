/* global fetch, Response, AbortSignal -- Node 18+ built-ins */
import crypto from "crypto";
import ApiError from "../classes/ApiError.js";
import config from "../config/index.js";

const API_URL = "https://api.revenuecat.com/v1";

/** Subset of `GET /v1/subscribers/{id}` that the backend uses. */
export type TRevenueCatEntitlement = {
  expires_date: string | null;
  grace_period_expires_date?: string | null;
  product_identifier: string;
  purchase_date: string;
};

export type TRevenueCatSubscription = {
  expires_date: string | null;
  purchase_date: string;
  original_purchase_date?: string;
  store: string;
  is_sandbox: boolean;
  unsubscribe_detected_at: string | null;
  billing_issues_detected_at: string | null;
  refunded_at?: string | null;
  grace_period_expires_date?: string | null;
  store_transaction_id?: string;
};

export type TRevenueCatSubscriber = {
  original_app_user_id: string;
  management_url: string | null;
  entitlements: Record<string, TRevenueCatEntitlement>;
  subscriptions: Record<string, TRevenueCatSubscription>;
};

/** Fields of a RevenueCat webhook `event` that the backend uses. */
export type TRevenueCatEvent = {
  id: string;
  type: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  transferred_from?: string[];
  transferred_to?: string[];
  product_id?: string;
  entitlement_ids?: string[] | null;
  store?: string;
  environment?: string;
  transaction_id?: string;
  original_transaction_id?: string;
  price_in_purchased_currency?: number | null;
  currency?: string | null;
  purchased_at_ms?: number;
  expiration_at_ms?: number | null;
  event_timestamp_ms?: number;
  cancel_reason?: string;
};

/** Reads a subscriber; RevenueCat creates an empty one for an unknown id. */
export const getSubscriber = async (
  appUserId: string
): Promise<TRevenueCatSubscriber> => {
  if (!config.revenueCat.apiKey) {
    throw new ApiError(500, "RevenueCat API key is not configured");
  }

  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/subscribers/${encodeURIComponent(appUserId)}`,
      {
        headers: {
          Authorization: `Bearer ${config.revenueCat.apiKey}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10_000),
      }
    );
  } catch (error) {
    console.error("RevenueCat request failed:", error);
    throw new ApiError(502, "Could not reach RevenueCat");
  }

  if (!response.ok) {
    console.error(
      `RevenueCat responded ${response.status}:`,
      await response.text().catch(() => "")
    );
    throw new ApiError(502, "RevenueCat request failed");
  }

  const body = (await response.json()) as { subscriber: TRevenueCatSubscriber };
  return body.subscriber;
};

const safeEqual = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

/**
 * RevenueCat sends the Authorization value configured in its dashboard as-is.
 * Accept it raw or with a `Bearer ` prefix.
 */
export const verifyWebhookAuth = (header: string | undefined) => {
  const secret = config.revenueCat.webhookSecret;
  if (!secret) {
    console.error("REVENUECAT_WEBHOOK_SECRET is not set; webhook rejected");
    return false;
  }
  if (!header) return false;
  const token = header.replace(/^Bearer\s+/i, "");
  return safeEqual(header, secret) || safeEqual(token, secret);
};
