import crypto from "crypto";
import {
  BillingCycle,
  NotificationModelType,
  Prisma,
  SubscriptionStatus,
} from "@prisma/client";
import ApiError from "../../classes/ApiError.js";
import config from "../../config/index.js";
import { notify, notifyAdmins } from "../notification/notification.utils.js";
import { findPackageByProduct } from "../package/package.service.js";
import { paymentServices } from "../payment/payment.service.js";
import prisma from "../../utils/prisma.js";
import {
  getSubscriber,
  TRevenueCatEntitlement,
  TRevenueCatEvent,
  TRevenueCatSubscriber,
  verifyWebhookAuth,
} from "../../utils/revenuecat.js";

const TEST_STORE = "TEST_API";

const FAILED_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.BILLING_ISSUE,
];
const ENDED_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.EXPIRED,
  SubscriptionStatus.CANCELLED,
];

type TPrevious = {
  id: string;
  status: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
} | null;

type TState = {
  status: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelledAt: Date | null;
  /** stable id used in notification dedupe keys */
  ref: string;
};

// ---------------------------------------------------------------- notifications

/** Push only on real status transitions, never on repeated webhooks. */
const notifyStatusChange = (
  authId: string,
  subscriptionId: string,
  old: TPrevious,
  state: TState
) => {
  const oldStatus = old?.status ?? null;
  const newStatus = state.status;
  if (oldStatus === newStatus) return;

  const period = state.currentPeriodEnd?.toISOString() ?? "none";
  const base = {
    receiverId: authId,
    modelType: NotificationModelType.SUBSCRIPTION,
    referenceId: subscriptionId,
  };

  if (newStatus === SubscriptionStatus.ACTIVE) {
    notify({
      ...base,
      message: "Welcome to Premium!",
      description: "All premium features are now unlocked.",
      dedupeKey: `sub-active:${subscriptionId}:${period}`,
    });
  } else if (
    FAILED_STATUSES.includes(newStatus) &&
    !(oldStatus && FAILED_STATUSES.includes(oldStatus))
  ) {
    notify({
      ...base,
      message: "Payment failed",
      description: "Please update your payment method to keep Premium.",
      dedupeKey: `sub-failed:${subscriptionId}:${period}`,
    });
  } else if (
    ENDED_STATUSES.includes(newStatus) &&
    oldStatus &&
    !ENDED_STATUSES.includes(oldStatus)
  ) {
    notify({
      ...base,
      message: "Your Premium has ended",
      description: "Subscribe again anytime to unlock all features.",
      dedupeKey: `sub-ended:${state.ref}:${period}`,
    });
  }
};

const getUserLabel = async (authId: string) => {
  const auth = await prisma.auth.findUnique({
    where: { id: authId },
    select: { name: true, email: true },
  });
  return auth ? `${auth.name} (${auth.email})` : "A user";
};

/** Admin in-app notifications for subscription changes (no push). */
const notifyAdminsOfChange = async (
  authId: string,
  old: TPrevious,
  state: TState
) => {
  const oldStatus = old?.status ?? null;
  const base = { referenceId: authId };
  const periodStart = state.currentPeriodStart?.toISOString() ?? "none";
  const periodEnd = state.currentPeriodEnd?.toISOString() ?? "none";

  if (
    state.status === SubscriptionStatus.ACTIVE &&
    oldStatus !== SubscriptionStatus.ACTIVE &&
    // recovering from a failed renewal is not a new subscription
    !(oldStatus && FAILED_STATUSES.includes(oldStatus))
  ) {
    notifyAdmins({
      ...base,
      message: "New subscription",
      description: `${await getUserLabel(authId)} subscribed to Premium`,
      modelType: NotificationModelType.NEW_SUBSCRIPTION,
      dedupeKey: `admin-sub-new:${state.ref}:${periodStart}`,
    });
  } else if (
    ENDED_STATUSES.includes(state.status) &&
    oldStatus &&
    !ENDED_STATUSES.includes(oldStatus)
  ) {
    notifyAdmins({
      ...base,
      message: "Subscription ended",
      description: `Premium ended for ${await getUserLabel(authId)}`,
      modelType: NotificationModelType.SUBSCRIPTION_CANCELED,
      dedupeKey: `admin-sub-ended:${state.ref}:${periodEnd}`,
    });
  } else if (
    state.cancelAtPeriodEnd &&
    !old?.cancelAtPeriodEnd &&
    state.status === SubscriptionStatus.ACTIVE
  ) {
    const endDate = state.currentPeriodEnd
      ? ` (Premium ends ${state.currentPeriodEnd.toISOString().slice(0, 10)})`
      : "";
    notifyAdmins({
      ...base,
      message: "Subscription canceled",
      description: `${await getUserLabel(authId)} canceled their subscription${endDate}`,
      modelType: NotificationModelType.SUBSCRIPTION_CANCELED,
      dedupeKey: `admin-sub-cancel:${state.ref}:${periodEnd}`,
    });
  }
};

/** Writes the new state and sends notifications for the transition. */
const saveState = async (
  authId: string,
  state: TState,
  data: Omit<
    Prisma.SubscriptionUncheckedCreateInput,
    keyof TState | "authId" | "id"
  >
) => {
  const old = await prisma.subscription.findUnique({
    where: { authId },
    select: { id: true, status: true, cancelAtPeriodEnd: true },
  });

  const { status, cancelAtPeriodEnd, currentPeriodStart, currentPeriodEnd } =
    state;
  const fields = {
    status,
    cancelAtPeriodEnd,
    currentPeriodStart,
    currentPeriodEnd,
    cancelledAt: state.cancelledAt,
  };
  const saved = await prisma.subscription.upsert({
    where: { authId },
    create: { authId, ...fields, ...data },
    update: { ...fields, ...data },
    select: { id: true },
  });

  notifyStatusChange(authId, saved.id, old, state);
  notifyAdminsOfChange(authId, old, state).catch(error =>
    console.error("Failed to notify admins:", error)
  );
  return saved;
};

// ---------------------------------------------------------------- RevenueCat sync

const toDate = (value?: string | null) => (value ? new Date(value) : null);

const isEntitlementActive = (ent: TRevenueCatEntitlement, now: number) => {
  const ends = [ent.expires_date, ent.grace_period_expires_date]
    .filter((v): v is string => !!v)
    .map(v => Date.parse(v));
  // null expiry = lifetime
  return !ent.expires_date || ends.some(end => end > now);
};

/** The subscriber's entitlement for one of our packages: active first, else latest. */
const pickEntitlement = async (subscriber: TRevenueCatSubscriber) => {
  const packages = await prisma.package.findMany({
    select: { entitlementId: true },
  });
  const known = new Set(packages.map(p => p.entitlementId));
  const now = Date.now();

  const entries = Object.entries(subscriber.entitlements ?? {}).filter(
    ([id]) => !known.size || known.has(id)
  );
  const active = entries.find(([, ent]) => isEntitlementActive(ent, now));
  if (active) return { id: active[0], ent: active[1], active: true };

  const latest = entries.sort(
    ([, a], [, b]) =>
      Date.parse(b.expires_date ?? "") - Date.parse(a.expires_date ?? "")
  )[0];
  return latest ? { id: latest[0], ent: latest[1], active: false } : null;
};

/**
 * Pulls the user's current state from the RevenueCat REST API and saves it.
 * The only place (besides test-purchase) that writes subscription state.
 * Webhook events can arrive out of order, so their payload is never trusted
 * for status - it only adds transaction ids and the raw event.
 */
const syncFromRevenueCat = async (authId: string, event?: TRevenueCatEvent) => {
  const subscriber = await getSubscriber(authId);
  const picked = await pickEntitlement(subscriber);

  if (!picked) {
    const local = await prisma.subscription.findUnique({
      where: { authId },
      select: { store: true, status: true, currentPeriodEnd: true },
    });
    // nothing in RevenueCat: leave test purchases and missing rows alone
    if (!local || local.store === TEST_STORE) return;
    if (local.status === SubscriptionStatus.EXPIRED) return;
    await saveState(
      authId,
      {
        status: SubscriptionStatus.EXPIRED,
        cancelAtPeriodEnd: false,
        currentPeriodStart: null,
        currentPeriodEnd: local.currentPeriodEnd,
        cancelledAt: null,
        ref: authId,
      },
      { revenueCatAppUserId: authId }
    );
    return;
  }

  const { id: entitlementId, ent, active } = picked;
  const productId = ent.product_identifier;
  const sub = subscriber.subscriptions?.[productId];

  let status: SubscriptionStatus = SubscriptionStatus.EXPIRED;
  if (active) status = SubscriptionStatus.ACTIVE;
  else if (sub?.refunded_at) status = SubscriptionStatus.CANCELLED;
  else if (sub?.billing_issues_detected_at)
    status = SubscriptionStatus.BILLING_ISSUE;

  const pkg = await findPackageByProduct(productId);
  const originalTransactionId = event?.original_transaction_id ?? null;

  await saveState(
    authId,
    {
      status,
      cancelAtPeriodEnd: active && !!sub?.unsubscribe_detected_at,
      currentPeriodStart: toDate(sub?.purchase_date ?? ent.purchase_date),
      currentPeriodEnd: toDate(ent.expires_date),
      cancelledAt: toDate(sub?.refunded_at ?? sub?.unsubscribe_detected_at),
      ref: originalTransactionId ?? `${authId}:${productId}`,
    },
    {
      revenueCatAppUserId: authId,
      packageId: pkg?.id ?? null,
      productId,
      entitlementId,
      store: sub?.store ?? null,
      environment: sub ? (sub.is_sandbox ? "SANDBOX" : "PRODUCTION") : null,
      managementUrl: subscriber.management_url ?? null,
      ...(event
        ? {
            lastEventId: event.id,
            rawEventData: event as unknown as Prisma.InputJsonValue,
            ...(originalTransactionId ? { originalTransactionId } : {}),
            ...(event.transaction_id
              ? { latestTransactionId: event.transaction_id }
              : {}),
          }
        : {}),
    }
  );
};

// ---------------------------------------------------------------- webhook

const OBJECT_ID = /^[a-f\d]{24}$/i;

/** First id that is one of our users (app_user_id = Auth.id after logIn). */
const resolveAuthId = async (ids: (string | undefined)[]) => {
  const candidates = [
    ...new Set(ids.filter((id): id is string => !!id && OBJECT_ID.test(id))),
  ];
  if (!candidates.length) return null;
  const users = await prisma.auth.findMany({
    where: { id: { in: candidates } },
    select: { id: true },
  });
  const found = new Set(users.map(u => u.id));
  return candidates.find(id => found.has(id)) ?? null;
};

const notifyAdminsOfBillingIssue = async (
  authId: string,
  event: TRevenueCatEvent
) => {
  notifyAdmins({
    message: "Payment failed",
    description: `Renewal payment failed for ${await getUserLabel(authId)}`,
    modelType: NotificationModelType.PAYMENT_FAILED,
    referenceId: authId,
    dedupeKey: `admin-payment-failed:${event.transaction_id ?? event.id}`,
  });
};

/** Payment row + admin alert shared by the webhook and test-purchase. */
const recordEvent = async (authId: string, event: TRevenueCatEvent) => {
  await paymentServices.upsertRevenueCatPayment(authId, event);
  if (event.type === "BILLING_ISSUE") {
    notifyAdminsOfBillingIssue(authId, event).catch(error =>
      console.error("Failed to notify admins:", error)
    );
  }
};

const handleRevenueCatWebhook = async (
  authHeader: string | undefined,
  body: { event?: TRevenueCatEvent } | undefined
) => {
  if (!verifyWebhookAuth(authHeader)) {
    throw new ApiError(401, "Invalid webhook authorization");
  }
  const event = body?.event;
  if (!event?.type) throw new ApiError(400, "Missing event");
  if (event.type === "TEST") return;

  if (event.type === "TRANSFER") {
    const ids = [
      ...(event.transferred_from ?? []),
      ...(event.transferred_to ?? []),
    ];
    for (const id of ids) {
      const authId = await resolveAuthId([id]);
      if (authId) await syncFromRevenueCat(authId, event);
    }
    return;
  }

  const authId = await resolveAuthId([
    event.app_user_id,
    event.original_app_user_id,
    ...(event.aliases ?? []),
  ]);
  if (!authId) {
    // anonymous or unknown user: acknowledge so RevenueCat stops retrying
    console.warn(
      `RevenueCat ${event.type} (${event.id}) has no matching user; ignored`
    );
    return;
  }

  await syncFromRevenueCat(authId, event);
  await recordEvent(authId, event);
};

// ---------------------------------------------------------------- user endpoints

const getMy = async (authId: string) => {
  const subscription = await prisma.subscription.findUnique({
    where: { authId },
    select: {
      status: true,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: true,
      store: true,
      managementUrl: true,
      createdAt: true,
      package: { select: { id: true, title: true, billingCycle: true } },
    },
  });
  if (!subscription) return null;

  return {
    status: subscription.status,
    isPremium: subscription.status === SubscriptionStatus.ACTIVE,
    autoRenew: !subscription.cancelAtPeriodEnd,
    endDate: subscription.currentPeriodEnd,
    store: subscription.store,
    managementUrl: subscription.managementUrl,
    package: subscription.package,
    createdAt: subscription.createdAt,
  };
};

/** POST /subscriptions/sync/revenuecat - call right after a purchase/restore. */
const sync = async (authId: string) => {
  await syncFromRevenueCat(authId);
  return getMy(authId);
};

const addCycle = (from: Date, cycle: BillingCycle) => {
  const end = new Date(from);
  if (cycle === BillingCycle.ANNUAL)
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return end;
};

/**
 * Simulates a purchase without RevenueCat (non-production only). The payment
 * goes through the same path as a real INITIAL_PURCHASE webhook.
 */
const testPurchase = async (authId: string, packageId: string) => {
  if (config.env === "production") throw new ApiError(404, "Not found");

  const pkg = await prisma.package.findFirst({
    where: { id: packageId, isDeleted: false },
  });
  if (!pkg) throw new ApiError(404, "Package not found");

  const now = new Date();
  const expiresAt = addCycle(now, pkg.billingCycle);
  const productId =
    pkg.revenueCatProductId || `test_premium_${pkg.billingCycle.toLowerCase()}`;
  const transactionId = `test_${crypto.randomUUID()}`;

  const event: TRevenueCatEvent = {
    id: transactionId,
    type: "INITIAL_PURCHASE",
    app_user_id: authId,
    product_id: productId,
    entitlement_ids: [pkg.entitlementId],
    store: TEST_STORE,
    environment: "SANDBOX",
    transaction_id: transactionId,
    original_transaction_id: transactionId,
    price_in_purchased_currency: pkg.price,
    currency: pkg.currency,
    purchased_at_ms: now.getTime(),
    expiration_at_ms: expiresAt.getTime(),
    event_timestamp_ms: now.getTime(),
  };

  // one row per user: the upsert replaces any previous subscription
  await saveState(
    authId,
    {
      status: SubscriptionStatus.ACTIVE,
      cancelAtPeriodEnd: false,
      currentPeriodStart: now,
      currentPeriodEnd: expiresAt,
      cancelledAt: null,
      ref: transactionId,
    },
    {
      revenueCatAppUserId: authId,
      packageId: pkg.id,
      productId,
      entitlementId: pkg.entitlementId,
      store: TEST_STORE,
      environment: "SANDBOX",
      originalTransactionId: transactionId,
      latestTransactionId: transactionId,
      lastEventId: event.id,
      managementUrl: null,
      rawEventData: event as unknown as Prisma.InputJsonValue,
    }
  );
  await recordEvent(authId, event);
  return getMy(authId);
};

export const subscriptionServices = {
  getMy,
  sync,
  testPurchase,
  handleRevenueCatWebhook,
};
